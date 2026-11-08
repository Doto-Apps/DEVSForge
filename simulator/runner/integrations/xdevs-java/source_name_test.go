package xdevsjava

import "testing"

func TestSourceNameUsesPublicDeclarationNotDisplayLabel(t *testing.T) {
	for _, code := range []string{"// public class Wrong {}\n public class Counter {}", `class Private {} public final class Counter {String example="public class Wrong";}`} {
		if got := SourceName(code, "Counter with a display label "); got != "Counter" {
			t.Fatalf("got %s", got)
		}
	}
}

func TestSourceNameUsesJavaIdentifiers(t *testing.T) {
	if got := SourceName("public class Compteur$Événement {}", "display name "); got != "Compteur$Événement" {
		t.Fatalf("Java type name lost: %q", got)
	}
}
