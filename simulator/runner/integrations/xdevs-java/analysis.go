package xdevsjava

import (
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
)

func PrepareAnalysis(w *generators.WrapperInfo, source string) error {
	for _, folder := range []string{"src/main/java/com/devsforge/runner/modeling", "src/main/generated"} {
		if err := util.LinkLibrary(source, w.ModelDir, folder); err != nil {
			return err
		}
	}
	return generators.PrepareJavaProjectMetadata(w)
}
