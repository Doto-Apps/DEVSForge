package xdevspython

import (
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
)

func PrepareAnalysis(w *generators.WrapperInfo, source string) error {
	return util.LinkLibrary(source, w.ModelDir, "modeling")
}
