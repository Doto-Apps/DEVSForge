// Package cmd : Run a go model
package cmd

import (
	"context"
	devspb "devsforge/simulator/proto/go"
	"devsforge/simulator/runner/internal"
	"devsforge/simulator/shared"
	"devsforge/simulator/shared/utils"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

// LaunchRunner Launch a runner with args
func LaunchRunner(args []string) error {
	log.SetPrefix("[RUNNER] ")
	log.Println("======================================")
	log.Println("          ⚙️ DEVSForge Runner         ")
	log.Println("======================================")
	fs := flag.NewFlagSet("runner", flag.ContinueOnError)
	jsonStr := fs.String("json", "", "JSON string to parse")
	filePath := fs.String("file", "", "Path to JSON file")
	configFile := fs.String("config", "", "Path to YAML config file")

	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("error parsing flags: %w", err)
	}

	if *configFile == "" {
		return fmt.Errorf("⚠️ No config file provided ")
	}

	var manifest shared.RunnableManifest
	if *jsonStr != "" {
		if err := utils.ParseManifest(*jsonStr, &manifest); err != nil {
			return fmt.Errorf("error parsing JSON: %w", err)
		}
	} else if *filePath != "" {
		data, err := os.ReadFile(*filePath)
		if err != nil {
			return fmt.Errorf("error reading file: %w", err)
		}
		if err := utils.ParseManifest(string(data), &manifest); err != nil {
			return fmt.Errorf("error parsing JSON file: %w", err)
		}
	} else {
		return fmt.Errorf("please provide --json or --file")
	}

	if len(manifest.Models) != 1 {
		return fmt.Errorf("❌ Manifest has no models or more than 1. Runner can only run 1 model at the same time")
	}
	log.Println("✅ Manifest validated")
	// a remettre plutard
	/*
		switch manifest.Models[0].Language {
		case "go":

		case "java":
			panic("Python langage for runner is not implemented")
		case "python":
			panic("Python langage for runner is not implemented")
		default:
			panic("Model language not implemented")
		}*/

	LaunchSim(manifest, *configFile)

	log.Println("======================================")
	log.Println("   ⚙️ Runner ended successfully ✅    ")
	log.Println("======================================")
	return nil
}

func LaunchSim(manifest shared.RunnableManifest, yamlConfigFilePath string) error {
	log.Println("Init model")
	cfg := internal.InitConfig(manifest, yamlConfigFilePath)

	rootDir, err := os.MkdirTemp(".", "devsforge_"+manifest.SimulationID+"_")
	if err != nil {
		return fmt.Errorf("failed to create simulation temp dir: %w", err)
	}
	/*

		defer func() {
			if err := os.RemoveAll(rootDir); err != nil {
				log.Printf("⚠️ failed to remove temp dir %s: %v", rootDir, err)
			} else {
				log.Printf("🧹 temp dir %s removed", rootDir)
			}
		}()*/

	// Coucou antoine, c'est antoine ici tu peux changer ajouter le cas ou c'est un autre langage

	langageRoot := filepath.Join(rootDir, "go")
	if err := os.MkdirAll(langageRoot, 0o755); err != nil {
		return fmt.Errorf("failed to create go root dir: %w", err)
	}

	modelDir := filepath.Join(langageRoot, cfg.ID)
	if err := os.MkdirAll(modelDir, 0o755); err != nil {
		return fmt.Errorf("failed to create model dir: %w", err)
	}

	bootstrapPath := filepath.Join(modelDir, "main.go")
	modelPath := filepath.Join(modelDir, "model.go")

	if err := os.WriteFile(modelPath, []byte(cfg.Model.Code), 0o644); err != nil {
		return fmt.Errorf("failed to write model.go: %w", err)
	}

	bootstrapSrc := internal.GenerateBootstrapSource(cfg)
	if err := os.WriteFile(bootstrapPath, []byte(bootstrapSrc), 0o644); err != nil {
		return fmt.Errorf("failed to write main.go: %w", err)
	}

	modelJSON, err := json.Marshal(cfg.Model)
	if err != nil {
		return fmt.Errorf("failed to marshal model config for runner: %w", err)
	}

	// Lancement du wrapper
	cmd := exec.Command("go", "run", ".", "--json", string(modelJSON))
	cmd.Dir = modelDir
	portStr := strconv.Itoa(cfg.GRPC.Port)
	cmd.Env = append(os.Environ(), "GRPC_PORT="+portStr)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start model process: %w", err)
	}

	log.Printf("Started model process (id=%s, pid=%d)", cfg.ID, cmd.Process.Pid)

	// On surveille le process dans une goroutine
	procErrCh := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		procErrCh <- err
	}()

	// Cleanup du process à la fin de LaunchSim
	defer func() {
		if cmd.Process == nil {
			return
		}
		log.Printf("Stopping model process id=%s pid=%d", cfg.ID, cmd.Process.Pid)

		// S'il est déjà mort, Kill renverra une erreur, on log juste.
		if err := cmd.Process.Kill(); err != nil {
			log.Printf("⚠️ failed to kill model process (maybe already exited): %v", err)
		}
	}()

	// Connexion gRPC avec surveillance du process et timeout
	addr := fmt.Sprintf("%s:%d", cfg.GRPC.Host, cfg.GRPC.Port)
	log.Printf("Waiting for gRPC server at %s to be ready...", addr)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var conn *grpc.ClientConn
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for gRPC server to be ready")

		case perr := <-procErrCh:
			if perr != nil {
				return fmt.Errorf("model process exited before gRPC was ready: %w", perr)
			}
			return fmt.Errorf("model process exited before gRPC was ready (no error from Wait)")

		case <-ticker.C:
			// Tentative de connexion
			conn, err = grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				continue
			}

			// Test si le serveur répond vraiment avec un ping rapide
			testCtx, testCancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			modelClient := devspb.NewAtomicModelServiceClient(conn)
			_, testErr := modelClient.Initialize(testCtx, &emptypb.Empty{})
			testCancel()

			if testErr == nil {
				// Connexion réussie !
				log.Println("✅ gRPC server is ready and responding")
				goto connected
			}

			// Si ça a échoué, on ferme cette connexion et on réessaie
			conn.Close()
			conn = nil
		}
	}

connected:
	defer conn.Close()

	modelClient := devspb.NewAtomicModelServiceClient(conn)
	internal.SetModelClient(modelClient)

	// État local de la simulation DEVS côté runner
	var currentTime float64 = 0
	var nextTime float64 = math.Inf(1)

	// Boucle Kafka typée DEVS-SF
	cfg.Collector.StartDevsLoop(func(msg *shared.KafkaMessage) error {
		ctx := context.Background()

		switch msg.DevsType {

		// ======================
		// InitSim : Initialize + NextTime
		// ======================
		case shared.DevsTypeInitSim:
			t := 0.0
			if msg.Time != nil {
				t = msg.Time.T
			}
			currentTime = t

			// Initialisation du modèle
			if _, err := modelClient.Initialize(ctx, &emptypb.Empty{}); err != nil {
				return fmt.Errorf("Initialize error: %w", err)
			}

			// Calcul du sigma initial (TA)
			taResp, err := modelClient.TimeAdvance(ctx, &emptypb.Empty{})
			if err != nil {
				return fmt.Errorf("TimeAdvance error: %w", err)
			}
			sigma := taResp.GetSigma()
			nextTime = currentTime + sigma

			// Envoi du NextTime au coordinateur
			resp := &shared.KafkaMessage{
				DevsType: shared.DevsTypeNextTime,
				Time: &shared.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        currentTime,
				},
				NextTime: &shared.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        nextTime,
				},
				Sender: cfg.ID,
			}
			return cfg.Producer.SendDevsMessage(resp)

		// ======================
		// ExecuteTransition : internal / external / confluent
		// ======================
		case shared.DevsTypeExecuteTransition:
			if msg.Time == nil {
				return fmt.Errorf("ExecuteTransition without time")
			}
			t := msg.Time.T

			// Temps écoulé depuis le dernier état
			e := t - currentTime
			if e < 0 {
				e = 0
			}
			currentTime = t

			hasInputs := msg.ModelInputsOption != nil && len(msg.ModelInputsOption.PortValueList) > 0

			// 1) Injection des inputs dans les ports du modèle (AddInput gRPC)
			if hasInputs {
				for _, pv := range msg.ModelInputsOption.PortValueList {
					valueJSONBytes, err := json.Marshal(pv.Value)
					if err != nil {
						return fmt.Errorf("failed to marshal PortValue for port %s: %w", pv.PortIdentifier, err)
					}
					_, err = modelClient.AddInput(ctx, &devspb.InputMessage{
						PortName:  pv.PortIdentifier,
						ValueJson: string(valueJSONBytes),
					})
					if err != nil {
						return fmt.Errorf("AddInput error on port %s: %w", pv.PortIdentifier, err)
					}
				}
			}

			// 2) Choix du type de transition DEVS
			switch {
			case !hasInputs && t == nextTime:
				// Transition interne
				if _, err := modelClient.InternalTransition(ctx, &emptypb.Empty{}); err != nil {
					return fmt.Errorf("InternalTransition error: %w", err)
				}

			case hasInputs && t == nextTime:
				// Confluent (entrée + échéance interne)
				if _, err := modelClient.ConfluentTransition(ctx, &devspb.ElapsedTime{Value: e}); err != nil {
					return fmt.Errorf("ConfluentTransition error: %w", err)
				}

			case hasInputs && t < nextTime:
				// Transition externe (interruption avant nextTime)
				if _, err := modelClient.ExternalTransition(ctx, &devspb.ElapsedTime{Value: e}); err != nil {
					return fmt.Errorf("ExternalTransition error: %w", err)
				}

			default:
				log.Printf("⚠️ unexpected ExecuteTransition case: hasInputs=%v, t=%v, nextTime=%v", hasInputs, t, nextTime)
			}

			// 3) Nouveau nextTime après la transition (TA)
			taResp, err := modelClient.TimeAdvance(ctx, &emptypb.Empty{})
			if err != nil {
				return fmt.Errorf("TimeAdvance error: %w", err)
			}
			sigma := taResp.GetSigma()
			nextTime = currentTime + sigma

			// 4) Envoi de TransitionDone au coordinateur
			done := &shared.KafkaMessage{
				DevsType: shared.DevsTypeTransitionDone,
				Time: &shared.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        currentTime,
				},
				NextTime: &shared.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        nextTime,
				},
				Sender: cfg.ID,
			}
			return cfg.Producer.SendDevsMessage(done)

		// ======================
		// SendOutput : lambda + ModelOutputMessage
		// ======================
		case shared.DevsTypeSendOutput:
			if msg.Time != nil {
				currentTime = msg.Time.T
			}

			outResp, err := modelClient.Output(ctx, &emptypb.Empty{})
			if err != nil {
				return fmt.Errorf("Output error: %w", err)
			}

			var pvs []shared.PortValue
			for _, po := range outResp.Outputs {
				for _, v := range po.ValuesJson {
					pvs = append(pvs, shared.PortValue{
						PortIdentifier: po.PortName,
						PortType:       "", // tu pourras mettre un type plus tard
						Value:          v,  // c'est déjà une string JSON
					})
				}
			}

			outMsg := &shared.KafkaMessage{
				DevsType: shared.DevsTypeModelOutput,
				Time: &shared.SimTime{
					TimeType: "devs.msg.time.DoubleSimTime",
					T:        currentTime,
				},
				Sender: cfg.ID,
				ModelOutput: &shared.ModelOutput{
					PortValueList: pvs,
				},
			}
			return cfg.Producer.SendDevsMessage(outMsg)

		// ======================
		// SimulationDone : Finalize
		// ======================
		case shared.DevsTypeSimulationDone:
			if _, err := modelClient.Finalize(ctx, &emptypb.Empty{}); err != nil {
				return fmt.Errorf("Finalize error: %w", err)
			}
			log.Println("SimulationDone received, model finalized.")
			return nil

		default:
			log.Printf("⚠️ Unhandled DevsType: %s", msg.DevsType)
			return nil
		}
	})

	return nil
}
