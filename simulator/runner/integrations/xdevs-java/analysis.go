package xdevsjava

import (
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	"os"
	"path/filepath"
	"regexp"
)

func PrepareAnalysis(w *generators.WrapperInfo, source string) error {
	for _, folder := range []string{"src/main/java/com/devsforge/runner/modeling", "src/main/generated"} {
		if err := util.LinkLibrary(source, w.ModelDir, folder); err != nil {
			return err
		}
	}
	for _, file := range []string{"pom.xml", ".project"} {
		p := filepath.Join(w.ModelDir, file)
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		tag := "artifactId"
		if file == ".project" {
			tag = "name"
		}
		re := regexp.MustCompile("<" + tag + ">[^<]+</" + tag + ">")
		loc := re.FindIndex(b)
		if loc != nil {
			b = append(append(append([]byte{}, b[:loc[0]]...), []byte("<"+tag+">model-"+w.Cfg.Model.ID+"</"+tag+">")...), b[loc[1]:]...)
		}
		if err = os.WriteFile(p, b, 0600); err != nil {
			return err
		}
	}
	return nil
}
