package ms4mejava

import (
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
)

func PrepareAnalysis(w *generators.WrapperInfo, source string) error {
	// JDT LS resolves the actual Closure-DEVS JAR through the project's Maven POM.
	// This never builds or runs the user's model.
	for _, folder := range []string{"dependencies", "src/main/generated"} {
		if err := util.LinkLibrary(source, w.ModelDir, folder); err != nil {
			return err
		}
	}
	return generators.PrepareJavaProjectMetadata(w)
}
