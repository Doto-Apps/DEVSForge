// Package integrations registers the compiled preparation adapters.
package integrations

import (
	devsimpyadapter "devsforge-runner/integrations/devsimpy-python"
	ms4adapter "devsforge-runner/integrations/ms4me-java"
	goadapter "devsforge-runner/integrations/xdevs-go"
	javaadapter "devsforge-runner/integrations/xdevs-java"
	pyadapter "devsforge-runner/integrations/xdevs-python"
	"devsforge-runner/internal/generators"
	shared "devsforge-shared"
	catalogue "devsforge-shared/integrations"
	"fmt"
)

type Preparation struct {
	Analysis   func(*generators.WrapperInfo, string) error
	SourceName func(string, string) string
	Sources    func(*generators.WrapperInfo, shared.RunnableManifest) error
	Launch     func(*generators.WrapperInfo, shared.RunnableManifest) error
}

var adapters = map[string]Preparation{
	"devsimpy-python": {Sources: devsimpyadapter.PrepareSources, Launch: devsimpyadapter.PrepareWrapper, Analysis: devsimpyadapter.PrepareAnalysis},
	"ms4me-java":      {Sources: ms4adapter.PrepareSources, Launch: ms4adapter.PrepareWrapper, Analysis: ms4adapter.PrepareAnalysis, SourceName: ms4adapter.SourcePath},
	"xdevs-go":        {Sources: goadapter.PrepareSources, Launch: goadapter.PrepareGoWraper, Analysis: goadapter.PrepareAnalysis},
	"xdevs-python":    {Sources: pyadapter.PrepareSources, Launch: pyadapter.PreparePythonWraper, Analysis: pyadapter.PrepareAnalysis},
	"xdevs-java":      {Sources: javaadapter.PrepareSources, Launch: javaadapter.PrepareJavaWrapper, Analysis: javaadapter.PrepareAnalysis, SourceName: javaadapter.SourceName},
}

func Get(key string) (Preparation, error) {
	p, ok := adapters[key]
	if !ok {
		return p, fmt.Errorf("preparation %q is not registered", key)
	}
	return p, nil
}
func Validate() error {
	defs, err := catalogue.List()
	if err != nil {
		return err
	}
	for _, d := range defs {
		if d.Capabilities.Simulation {
			if _, err = Get(d.Preparation); err != nil {
				return err
			}
		}
	}
	return nil
}
