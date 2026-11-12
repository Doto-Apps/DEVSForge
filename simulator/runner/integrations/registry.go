// Package integrations registers the compiled preparation adapters.
package integrations

import (
	goadapter "devsforge-runner/integrations/xdevs-go"
	javaadapter "devsforge-runner/integrations/xdevs-java"
	pyadapter "devsforge-runner/integrations/xdevs-python"
	"devsforge-runner/internal/generators"
	shared "devsforge-shared"
	catalogue "devsforge-shared/integrations"
	"fmt"
)

type Preparation struct {
	Launch func(*generators.WrapperInfo, shared.RunnableManifest) error
}

var adapters = map[string]Preparation{
	"xdevs-go":     {Launch: goadapter.PrepareGoWraper},
	"xdevs-python": {Launch: pyadapter.PreparePythonWraper},
	"xdevs-java":   {Launch: javaadapter.PrepareJavaWrapper},
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
