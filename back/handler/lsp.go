package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"devsforge-shared/integrations"
	"devsforge/database"
	"devsforge/middleware"
	"devsforge/model"
	ws "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gorilla/websocket"
)

type LSPSessionRequest struct {
	WorkbenchID        string `json:"workbenchId,omitempty"`
	DocumentID         string `json:"documentId,omitempty"`
	ModelID            string `json:"modelId,omitempty"`
	ModelName          string `json:"modelName"`
	Code               string `json:"code"`
	IntegrationID      string `json:"integrationId"`
	IntegrationVersion string `json:"integrationVersion"`
}
type LSPConnection struct {
	ID              string   `json:"id"`
	Ticket          string   `json:"ticket,omitempty"`
	AllowedCommands []string `json:"allowedCommands,omitempty"`
	URL             string   `json:"url"`
}
type LSPSessionResponse struct {
	DocumentID   string          `json:"documentId"`
	Status       string          `json:"status"`
	ID           string          `json:"id"`
	DocumentURI  string          `json:"documentUri"`
	WorkspaceURI string          `json:"workspaceUri"`
	Language     string          `json:"language"`
	Servers      []LSPConnection `json:"servers"`
}
type proxyTicket struct {
	User, Session, Engine string
	Expires               time.Time
}

var lspTickets = struct {
	sync.Mutex
	values map[string]proxyTicket
}{values: map[string]proxyTicket{}}
var lspHTTP = &http.Client{Timeout: 90 * time.Second}

func lspAddress() string {
	value := os.Getenv("LSP_ADDR")
	if value == "" {
		value = "http://lsp:8090"
	}
	return strings.TrimRight(value, "/")
}
func lspRequest(method, path, user string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest(method, lspAddress()+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("LSP_INTERNAL_TOKEN"))
	req.Header.Set("X-LSP-User", user)
	req.Header.Set("Content-Type", "application/json")
	return lspHTTP.Do(req)
}

// createLSPSession prepares an authenticated model or a generator draft.
// @Summary Create language server session
// @Tags LSP
// @Accept json
// @Produce json
// @Param body body LSPSessionRequest true "Unsaved editor document"
// @Success 201 {object} LSPSessionResponse
// @Router /lsp/sessions [post]
func createLSPSession(c *fiber.Ctx) error {
	var req LSPSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return SendRequestError(c, 400, err)
	}
	user := c.Locals("user_id").(string)
	if req.ModelID != "" {
		var m model.Model
		if err := database.DB.First(&m, "id = ? AND user_id = ? AND deleted_at IS NULL", req.ModelID, user).Error; err != nil {
			return SendRequestError(c, 404, err)
		}
		if m.Type != "atomic" || m.IntegrationID == nil || m.IntegrationVersion == nil {
			return SendRequestError(c, 400, fmt.Errorf("model has no executable integration"))
		}
		if req.ModelName == "" {
			req.ModelName = m.Name
		}
		req.IntegrationID = *m.IntegrationID
		req.IntegrationVersion = *m.IntegrationVersion
	}
	if _, err := integrations.Resolve(req.IntegrationID, req.IntegrationVersion, ""); err != nil {
		return SendRequestError(c, 400, err)
	}
	body, _ := json.Marshal(struct {
		LSPSessionRequest
		UserID string `json:"userId"`
	}{req, user})
	res, err := lspRequest("POST", "/sessions", user, body)
	if err != nil {
		return SendRequestError(c, 503, fmt.Errorf("language service unavailable"))
	}
	defer res.Body.Close()
	if res.StatusCode != 201 {
		data, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return c.Status(res.StatusCode).JSON(fiber.Map{"error": strings.TrimSpace(string(data))})
	}
	var out LSPSessionResponse
	if err = json.NewDecoder(res.Body).Decode(&out); err != nil {
		return SendRequestError(c, 502, err)
	}
	decorateLSPConnections(user, &out)
	return c.Status(201).JSON(out)
}

func decorateLSPConnections(user string, out *LSPSessionResponse) {
	lspTickets.Lock()
	for key, t := range lspTickets.values {
		if time.Now().After(t.Expires) {
			delete(lspTickets.values, key)
		}
	}
	for i := range out.Servers {
		engine := &out.Servers[i]
		lspTickets.values[engine.Ticket] = proxyTicket{User: user, Session: out.ID, Engine: engine.ID, Expires: time.Now().Add(30 * time.Second)}
		engine.URL = "/lsp/sessions/" + out.ID + "/ws/" + url.PathEscape(engine.ID) + "?ticket=" + url.QueryEscape(engine.Ticket)
		engine.Ticket = ""
	}
	lspTickets.Unlock()
}

// deleteLSPSession releases the language servers and their private workspace.
// @Summary Close language server session
// @Tags LSP
// @Param id path string true "Session ID"
// @Success 204
// @Router /lsp/sessions/{id} [delete]
func deleteLSPSession(c *fiber.Ctx) error {
	res, err := lspRequest("DELETE", "/sessions/"+url.PathEscape(c.Params("id")), c.Locals("user_id").(string), nil)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return c.SendStatus(fiber.StatusNoContent)
	}
	return c.SendStatus(res.StatusCode)
}

// getLSPFile reads an authorized dependency source for navigation.
// @Summary Read language server source
// @Tags LSP
// @Param id path string true "Session ID"
// @Param uri query string true "Source URI"
// @Produce plain
// @Success 200 {string} string
// @Router /lsp/sessions/{id}/file [get]
func getLSPFile(c *fiber.Ctx) error {
	res, err := lspRequest("GET", "/sessions/"+url.PathEscape(c.Params("id"))+"/file?uri="+url.QueryEscape(c.Query("uri")), c.Locals("user_id").(string), nil)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 2*1024*1024))
	if err != nil {
		return SendRequestError(c, 502, err)
	}
	c.Set("Content-Type", "text/plain; charset=utf-8")
	return c.Status(res.StatusCode).Send(body)
}

// getLSPWorkspace reports preparation and initialization progress.
// @Summary Read language workspace status
// @Tags LSP
// @Param id path string true "Workspace ID"
// @Success 200 {object} map[string]interface{}
// @Router /lsp/sessions/{id} [get]
func getLSPWorkspace(c *fiber.Ctx) error {
	return proxyLSPWorkspace(c, "GET", "/sessions/"+url.PathEscape(c.Params("id")))
}

// detachLSPDocument keeps the shared server alive for other documents.
// @Summary Detach language workspace document
// @Tags LSP
// @Param id path string true "Workspace ID"
// @Param document path string true "Document ID"
// @Success 204
// @Router /lsp/sessions/{id}/documents/{document} [delete]
func detachLSPDocument(c *fiber.Ctx) error {
	return proxyLSPWorkspace(c, "DELETE", "/sessions/"+url.PathEscape(c.Params("id"))+"/documents/"+url.PathEscape(c.Params("document")))
}

// renewLSPConnections issues fresh short-lived connection tickets.
// @Summary Renew language workspace connections
// @Tags LSP
// @Param id path string true "Workspace ID"
// @Success 200 {object} LSPSessionResponse
// @Router /lsp/sessions/{id}/tickets [post]
func renewLSPConnections(c *fiber.Ctx) error {
	user := c.Locals("user_id").(string)
	res, err := lspRequest("POST", "/sessions/"+url.PathEscape(c.Params("id"))+"/tickets", user, nil)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return c.SendStatus(res.StatusCode)
	}
	var out LSPSessionResponse
	if err = json.NewDecoder(res.Body).Decode(&out); err != nil {
		return SendRequestError(c, 502, err)
	}
	decorateLSPConnections(user, &out)
	return c.JSON(out)
}
func proxyLSPWorkspace(c *fiber.Ctx, method, path string) error {
	res, err := lspRequest(method, path, c.Locals("user_id").(string), nil)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 4096))
	if err != nil {
		return SendRequestError(c, 502, err)
	}
	c.Set("Content-Type", "application/json")
	return c.Status(res.StatusCode).Send(data)
}

func SetupLSPRoutes(app *fiber.App) {
	app.Get("/lsp/sessions/:id/ws/:engine", func(c *fiber.Ctx) error {
		origin := c.Get("Origin")
		if origin != "" {
			u, err := url.Parse(origin)
			if err != nil {
				return c.SendStatus(403)
			}
			allowed := u.Host == c.Hostname()
			for _, v := range strings.Split(os.Getenv("LSP_ALLOWED_ORIGINS"), ",") {
				if origin == strings.TrimSpace(v) && v != "" {
					allowed = true
				}
			}
			if !allowed {
				return c.SendStatus(403)
			}
		}
		key := c.Query("ticket")
		lspTickets.Lock()
		ticket, ok := lspTickets.values[key]
		delete(lspTickets.values, key)
		lspTickets.Unlock()
		if !ok || time.Now().After(ticket.Expires) || ticket.Session != c.Params("id") || ticket.Engine != c.Params("engine") {
			return c.SendStatus(401)
		}
		c.Locals("lsp_user", ticket.User)
		return c.Next()
	}, ws.New(func(client *ws.Conn) {
		target := strings.Replace(lspAddress(), "http", "ws", 1) + "/sessions/" + url.PathEscape(client.Params("id")) + "/ws/" + url.PathEscape(client.Params("engine")) + "?ticket=" + url.QueryEscape(client.Query("ticket"))
		headers := http.Header{}
		headers.Set("Authorization", "Bearer "+os.Getenv("LSP_INTERNAL_TOKEN"))
		headers.Set("X-LSP-User", client.Locals("lsp_user").(string))
		upstream, _, err := websocket.DefaultDialer.Dial(target, headers)
		if err != nil {
			_ = client.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1011, "Language service unavailable"), time.Now().Add(time.Second))
			return
		}
		downstream := client.Conn
		defer upstream.Close()
		defer downstream.Close()
		downstream.SetReadLimit(2 * 1024 * 1024)
		upstream.SetReadLimit(4 * 1024 * 1024)
		done := make(chan struct{})
		go func() {
			defer close(done)
			defer func() {
				// fasthttp closes a hijacked connection when its handler returns.
				// Wake the downstream reader as well as notifying the browser.
				_ = downstream.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "Language assistance stopped"), time.Now().Add(time.Second))
				_ = downstream.SetReadDeadline(time.Now())
				_ = downstream.Close()
			}()
			for {
				kind, data, err := upstream.ReadMessage()
				if err != nil {
					return
				}
				_ = downstream.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if downstream.WriteMessage(kind, data) != nil {
					return
				}
			}
		}()
		defer func() { _ = upstream.Close(); <-done }()
		for {
			kind, data, err := downstream.ReadMessage()
			if err != nil {
				return
			}
			if upstream.WriteMessage(kind, data) != nil {
				return
			}
			select {
			case <-done:
				return
			default:
			}
		}
	}))
	group := app.Group("/lsp", middleware.Protected())
	group.Post("/sessions", createLSPSession)
	group.Get("/sessions/:id", getLSPWorkspace)
	group.Post("/sessions/:id/tickets", renewLSPConnections)
	group.Delete("/sessions/:id/documents/:document", detachLSPDocument)
	group.Delete("/sessions/:id", deleteLSPSession)
	group.Get("/sessions/:id/file", getLSPFile)
}
