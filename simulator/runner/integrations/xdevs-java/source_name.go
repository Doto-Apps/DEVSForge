package xdevsjava

import "devsforge-runner/internal/generators"

func SourceName(code, fallback string) string {
	return generators.JavaSourceName(code, fallback)
}
