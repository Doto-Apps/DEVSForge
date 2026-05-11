// Package templates provides embedded template files and template management.
package templates

import "embed"

//go:embed go/*.tmpl python/*.tmpl java/*.tmpl
var FS embed.FS
