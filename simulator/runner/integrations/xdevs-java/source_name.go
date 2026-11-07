package xdevsjava

import (
	"devsforge-shared/integrations"
	"strings"
	"text/scanner"
	"unicode"
)

// SourceName reads declarations without compiling or executing user code.
func SourceName(code, fallback string) string {
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
