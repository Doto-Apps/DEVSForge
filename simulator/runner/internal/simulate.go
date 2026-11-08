package internal

import (
	"context"
	"devsforge-runner/integrations"
	"devsforge-runner/internal/generators"
	"devsforge-runner/internal/runner"
	shared "devsforge-shared"
	catalogue "devsforge-shared/integrations"
	devspb "devsforge-shared/proto"
	"fmt"
	"log/slog"
)

const ErrorRunnerPrepare int64 = 5004

func LaunchSim(lang shared.CodeLanguage, wrapper *generators.WrapperInfo, manifest shared.RunnableManifest) error {
	cfg := wrapper.Cfg
	if cfg == nil {
		return fmt.Errorf("missing config")
	}

	runnerInstance := runner.CreateRunner(cfg, context.Background())
	d, err := catalogue.Resolve(cfg.Model.IntegrationID, cfg.Model.IntegrationVersion, string(lang))
	if err != nil {
		return err
	}
	preparation, err := integrations.Get(d.Preparation)
	if err != nil {
		return err
	}
	if err = preparation.Launch(wrapper, manifest); err != nil {
		if sendErr := runnerInstance.SendErrorReport(ErrorRunnerPrepare, err); sendErr != nil {
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
