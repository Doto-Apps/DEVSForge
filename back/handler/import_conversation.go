package handler

import (
	"bytes"
	"crypto/subtle"
	"devsforge-shared/integrations"
	"devsforge/config"
	"devsforge/enum"
	"devsforge/exchange"
	modeljson "devsforge/json"
	"devsforge/lib"
	"devsforge/model"
	"encoding/json"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"
)

type ImportTurn struct {
	Action        string  `json:"action"`
	Instructions  string  `json:"instructions"`
	TargetID      string  `json:"targetIntegrationId"`
	TargetVersion string  `json:"targetIntegrationVersion"`
	RootID        string  `json:"rootId"`
	MaxTime       float64 `json:"maxTime"`
}

// @Summary Discuss, adapt or verify an import draft
// @Tags Imports
// @Accept json
// @Produce json
// @Param id path string true "Import id"
// @Param body body ImportTurn true "Next step"
// @Success 202 {object} ImportJob
// @Router /imports/{id}/turns [post]
func continueImport(c *fiber.Ctx) error {
	if !importJobID.MatchString(c.Params("id")) {
		return SendRequestError(c, 400, fmt.Errorf("invalid import id"))
	}
	var input ImportTurn
	if err := c.BodyParser(&input); err != nil {
		return SendRequestError(c, 400, err)
	}
	if input.Action != "discuss" && input.Action != "adapt" && input.Action != "test" && input.Action != "restore" {
		return SendRequestError(c, 400, fmt.Errorf("unknown action"))
	}
	if input.MaxTime == 0 {
		input.MaxTime = 100
	}
	if math.IsNaN(input.MaxTime) || math.IsInf(input.MaxTime, 0) || input.MaxTime <= 0 || input.MaxTime > 1000000 || len(input.Instructions) > 12000 {
		return SendRequestError(c, 400, fmt.Errorf("invalid message or simulation horizon"))
	}
	// After a commit the same receipt must never silently save a different revision.
	var committed int64
	if err := databaseImportCommitted(c, &committed); err != nil {
		return SendRequestError(c, 500, err)
	}
	if committed > 0 {
		return SendRequestError(c, 409, fmt.Errorf("this import was already saved; start a new import to create another version"))
	}
	body := map[string]any{"action": input.Action, "instructions": input.Instructions, "maxTime": input.MaxTime, "rootId": input.RootID, "mode": "ai"}
	if input.Action == "discuss" || input.Action == "adapt" {
		_, settings, err := getOpenAIClientForUser(c.Locals("user_id").(string))
		if err != nil {
			return SendRequestError(c, 400, err)
		}
		body["llm"] = map[string]string{"url": settings.APIURL, "key": settings.APIKey, "model": settings.APIModel}
		defs, err := integrations.List()
		if err != nil {
			return SendRequestError(c, 500, err)
		}
		body["integrations"] = defs
		contexts := []map[string]string{}
		for _, d := range defs {
			if !d.Capabilities.AI {
				continue
			}
			contract, err := d.ModelPrompt()
			if err != nil {
				return SendRequestError(c, 500, err)
			}
			contexts = append(contexts, map[string]string{"id": d.ID, "version": d.Version, "contract": contract})
		}
		body["integrationContexts"] = contexts
		if input.Action == "adapt" {
			d, err := integrations.Resolve(input.TargetID, input.TargetVersion, "")
			if err != nil {
				return SendRequestError(c, 400, err)
			}
			if !d.Capabilities.AI || !d.Capabilities.Simulation {
				return SendRequestError(c, 400, fmt.Errorf("target does not support adaptation and simulation"))
			}
			contract, err := d.ModelPrompt()
			if err != nil {
				return SendRequestError(c, 500, err)
			}
			body["target"] = map[string]any{"id": d.ID, "version": d.Version, "language": d.Language, "framework": d.Framework, "instructions": contract}
		}
	}
	status, data, err := workerRequest(c, "POST", "/jobs/"+c.Params("id")+"/turns", body)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	return c.Status(status).Type("json").Send(data)
}

// draftModels uses the normal manifest compiler without creating library or simulation records.
func draftModels(p exchange.Package) []model.Model {
	models := make([]model.Model, 0, len(p.Models))
	for _, s := range p.Models {
		m := model.Model{ID: s.ID, Name: s.Name, Type: enum.ModelType(s.Type), Language: s.Language, Code: s.Code, Ports: append([]modeljson.ModelPort{}, s.Ports...), Connections: s.Connections, Metadata: defaultImportedMetadata(), ImportSource: &modeljson.ImportSource{Language: s.Language, Framework: s.Framework, Reason: s.BlockedReason}}
		m.Metadata.Parameters = s.Parameters
		if s.Type == "atomic" && s.IntegrationID != "" {
			id, version := s.IntegrationID, s.IntegrationVersion
			m.IntegrationID = &id
			m.IntegrationVersion = &version
		}
		for i := range m.Ports {
			m.Ports[i].ID = m.Ports[i].Name
		}
		for _, c := range s.Components {
			metadata := defaultImportedMetadata()
			for _, child := range p.Models {
				if child.ID == c.ModelID {
					for _, param := range child.Parameters {
						if value, ok := c.ParameterOverrides[param.Name]; ok {
							param.Value = value
						}
						metadata.Parameters = append(metadata.Parameters, param)
					}
				}
			}
			m.Components = append(m.Components, modeljson.ModelComponent{InstanceID: c.InstanceID, ModelID: c.ModelID, InstanceMetadata: &metadata})
		}
		models = append(models, m)
	}
	return models
}

func draftRootModels(p exchange.Package, root string) []model.Model {
	all := draftModels(p)
	byID := make(map[string]model.Model, len(all))
	for _, m := range all {
		byID[m.ID] = m
	}
	seen := map[string]bool{}
	selected := []model.Model{}
	var visit func(string)
	visit = func(id string) {
		if seen[id] {
			return
		}
		seen[id] = true
		m, ok := byID[id]
		if !ok {
			return
		}
		selected = append(selected, m)
		for _, c := range m.Components {
			visit(c.ModelID)
		}
	}
	visit(root)
	return selected
}

func verifyImportDraft(c *fiber.Ctx) error {
	token := os.Getenv("IMPORT_INTERNAL_TOKEN")
	if token == "" || subtle.ConstantTimeCompare([]byte(c.Get("Authorization")), []byte("Bearer "+token)) != 1 {
		return c.SendStatus(401)
	}
	var input struct {
		Package exchange.Package `json:"package"`
		RootID  string           `json:"rootId"`
		MaxTime float64          `json:"maxTime"`
	}
	if err := c.BodyParser(&input); err != nil {
		return SendRequestError(c, 400, err)
	}
	if err := input.Package.Validate(); err != nil {
		return c.Status(422).JSON(fiber.Map{"status": "blocked", "error": err.Error()})
	}
	if math.IsNaN(input.MaxTime) || math.IsInf(input.MaxTime, 0) || input.MaxTime <= 0 || input.MaxTime > 1000000 {
		return c.SendStatus(400)
	}
	rootFound := false
	for _, root := range input.Package.Roots {
		if root == input.RootID {
			rootFound = true
		}
	}
	if !rootFound {
		return c.Status(422).JSON(fiber.Map{"status": "blocked", "error": "Select a root model from this package"})
	}
	resolveImportedProfiles(&input.Package)
	manifest, err := lib.ModelToManifest(draftRootModels(input.Package, input.RootID), input.RootID, uuid.NewString(), input.MaxTime, nil)
	if err != nil {
		return c.Status(422).JSON(fiber.Map{"status": "blocked", "error": err.Error()})
	}
	data, err := json.Marshal(map[string]any{"manifest": manifest, "kafka": config.Get().Kafka.Address})
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	req, err := http.NewRequestWithContext(c.UserContext(), "POST", strings.TrimRight(config.Get().Simulator.Addr, "/")+"/verify-import", bytes.NewReader(data))
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := (&http.Client{Timeout: 100 * time.Second}).Do(req)
	if err != nil {
		return c.Status(503).JSON(fiber.Map{"status": "unavailable", "error": "Simulation verification service unavailable"})
	}
	defer func() { _ = res.Body.Close() }()
	data, err = io.ReadAll(io.LimitReader(res.Body, 128<<10))
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	return c.Status(res.StatusCode).Type("json").Send(data)
}
