// Package ms4mejava prepares Closure-DEVS models without changing their source code.
package ms4mejava

import (
	"devsforge-runner/internal/generators"
	"path/filepath"
	"strings"
	"text/scanner"
	"unicode"
)

// SourcePath preserves the declared Java package, including in analysis projects.
// Every path segment comes from an identifier, never from a display label or string literal.
func SourcePath(code, fallback string) string {
	name := generators.JavaSourceName(code, fallback)
	pkg := packageName(code)
	if pkg == "" {
		return name
	}
	return filepath.Join(strings.ReplaceAll(pkg, ".", string(filepath.Separator)), name)
}

func packageName(code string) string {
	var s scanner.Scanner
	s.Init(strings.NewReader(code))
	s.IsIdentRune = func(r rune, i int) bool {
		return unicode.In(r, unicode.L, unicode.Nl, unicode.Sc, unicode.Pc) || (i > 0 && unicode.In(r, unicode.Mn, unicode.Mc, unicode.Nd, unicode.Cf))
	}
	s.Error = func(*scanner.Scanner, string) {}
	for token := s.Scan(); token != scanner.EOF; token = s.Scan() {
		switch s.TokenText() {
		case "class", "interface", "enum", "record", "{":
			return ""
		case "package":
			parts := []string{}
			for {
				if s.Scan() != scanner.Ident {
					return ""
				}
				parts = append(parts, s.TokenText())
				switch s.Scan() {
				case ';':
					return strings.Join(parts, ".")
				case '.':
				default:
					return ""
				}
			}
		}
	}
	return ""
}
