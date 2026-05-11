package internal

import (
	"context"
	"devsforge-runner/internal/generators"
	"devsforge-runner/internal/runner"
	shared "devsforge-shared"
	devspb "devsforge-wrapper/proto"
	"fmt"
	"log/slog"
)

var (
	ErrorRunnerPrepareGo           int64 = 5001
	ErrorRunnerPreparePython       int64 = 5002
	ErrorRunnerPrepareJava         int64 = 5003
	ErrorRunnerUnsupportedLanguage int64 = 5004
)

func LaunchSim(lang shared.CodeLanguage, wrapper *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("missing config")
	}

	runnerInstance := runner.CreateRunner(cfg, context.Background())
	switch lang {
	case "go":
		if err := generators.PrepareGoWraper(wrapper, manifest); err != nil {
			sendErr := runnerInstance.SendErrorReport(ErrorRunnerPrepareGo, err)
			if sendErr != nil {
				slog.Warn("cannot send error report", "error", sendErr)
			}
			return err
		}
	case "python":
		if err := generators.PreparePythonWraper(wrapper, manifest); err != nil {
			sendErr := runnerInstance.SendErrorReport(ErrorRunnerPreparePython, err)
			if sendErr != nil {
				slog.Warn("cannot send error report", "error", sendErr)
			}
			return err
		}
	case "java":
		if err := generators.PrepareJavaWrapper(wrapper, manifest); err != nil {
			sendErr := runnerInstance.SendErrorReport(ErrorRunnerPrepareJava, err)
			if sendErr != nil {
				slog.Warn("cannot send error report", "error", sendErr)
			}
			return err
		}
	default:
		err := fmt.Errorf("runner cannot handle language %s", lang)
		sendErr := runnerInstance.SendErrorReport(ErrorRunnerUnsupportedLanguage, err)
		if sendErr != nil {
			slog.Warn("cannot send error report", "error", sendErr)
		}
		return err
	}

	if wrapper.GRPCConn == nil {
		return fmt.Errorf("missing gRPC connection (wrapper not prepared?)")
	}
	if wrapper.Cmd == nil {
		return fmt.Errorf("missing cmd (wrapper not prepared?)")
	}

	modelClient := devspb.NewAtomicModelServiceClient(wrapper.GRPCConn)
	runnerInstance.ModelClient = modelClient

	return runnerInstance.Run()
}
