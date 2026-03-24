package templates

import "embed"

//go:embed go/*.tmpl python/*.tmpl
var FS embed.FS
