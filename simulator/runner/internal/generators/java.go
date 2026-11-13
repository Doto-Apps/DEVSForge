package generators

import (
	"devsforge-shared/integrations"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"text/scanner"
	"unicode"
)

// JavaSourceName reads declarations without compiling or executing user code.
func JavaSourceName(code, fallback string) string {
	var s scanner.Scanner
	s.Init(strings.NewReader(code))
	s.IsIdentRune = func(r rune, i int) bool {
		return unicode.In(r, unicode.L, unicode.Nl, unicode.Sc, unicode.Pc) || (i > 0 && unicode.In(r, unicode.Mn, unicode.Mc, unicode.Nd, unicode.Cf))
	}
	s.Error = func(*scanner.Scanner, string) {}
	depth := 0
	public := false
	kind := false
	for token := s.Scan(); token != scanner.EOF; token = s.Scan() {
		text := s.TokenText()
		if text == "{" {
			depth++
			public = false
		}
		if text == "}" {
			depth--
			public = false
		}
		if depth != 0 {
			continue
		}
		if kind && token == scanner.Ident {
			return text
		}
		if text == "public" {
			public = true
		}
		if public && (text == "class" || text == "interface" || text == "enum" || text == "record") {
			kind = true
		}
		if text == ";" {
			public = false
			kind = false
		}
	}
	fallback = strings.TrimSpace(fallback)
	if integrations.ValidName(fallback) {
		return fallback
	}
	return "Model"
}

// JavaTool uses the same JDK for compilation and execution when JAVA_HOME is set.
func JavaTool(name string) string {
	if home := os.Getenv("JAVA_HOME"); home != "" {
		return filepath.Join(home, "bin", name)
	}
	return name
}

// PrepareJavaProjectMetadata gives each Maven analysis project its own identity.
func PrepareJavaProjectMetadata(w *WrapperInfo) error {
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
