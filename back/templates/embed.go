// Package templates provides embedded template files and template management.
package templates

import "embed"

//go:embed go/*.tmpl python/*.tmpl
var FS embed.FS
