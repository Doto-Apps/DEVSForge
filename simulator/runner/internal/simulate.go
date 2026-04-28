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

var ERROR_RUNNER_PREPARE_GO int64 = 5001
var ERROR_RUNNER_PREPARE_PYTHON int64 = 5002
var ERROR_RUNNER_PREPARE_JAVA int64 = 5003
var ERROR_RUNNER_UNSUPPORTED_LANGUAGE int64 = 5004

func LaunchSim(lang shared.CodeLanguage, wrapper *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("LaunchSim: missing config")
	}

	modelClient := devspb.NewAtomicModelServiceClient(wrapper.GRPCConn)
	runnerInstance := runner.CreateRunner(cfg, context.Background(), modelClient)
	switch lang {
	case "go":
		if err := generators.PrepareGoWraper(wrapper, manifest); err != nil {
			sendErr := runnerInstance.SendErrorReport(ERROR_RUNNER_PREPARE_GO, err)
			if sendErr != nil {
				slog.Warn("cannot send error report", "error", sendErr)
			}
			return err
		}
	case "python":
		if err := generators.PreparePythonWraper(wrapper, manifest); err != nil {
			sendErr := runnerInstance.SendErrorReport(ERROR_RUNNER_PREPARE_PYTHON, err)
			if sendErr != nil {
				slog.Warn("cannot send error report", "error", sendErr)
			}
			return err
		}
	case "java":
		if err := generators.PrepareJavaWrapper(wrapper, manifest); err != nil {
			sendErr := runnerInstance.SendErrorReport(ERROR_RUNNER_PREPARE_JAVA, err)
			if sendErr != nil {
				slog.Warn("cannot send error report", "error", sendErr)
			}
			return err
		}
	default:
		err := fmt.Errorf("runner cannot handle language %s", lang)
		sendErr := runnerInstance.SendErrorReport(ERROR_RUNNER_UNSUPPORTED_LANGUAGE, err)
		if sendErr != nil {
			slog.Warn("cannot send error report", "error", sendErr)
		}
		return err
	}

	if wrapper.GRPCConn == nil {
		return fmt.Errorf("launchSim: missing gRPC connection (wrapper not prepared?)")
	}
	if wrapper.Cmd == nil {
		return fmt.Errorf("launchSim: missing cmd (wrapper not prepared?)")
	}

	return runnerInstance.Run()
}
