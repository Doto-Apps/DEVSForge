package testsutils

import (
	"encoding/json"
)

// NormalizeMessageIds remplace tous les messageId par "test-uuid"
// pour rendre les tests déterministes
func NormalizeMessageIds(data []byte) []byte {
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return data // Retourner original si erreur
	}

	replaceIds(m)

	normalized, err := json.MarshalIndent(m, "", "    ")
	if err != nil {
		return data
	}
	return normalized
}

// replaceIds parcourt récursivement et remplace les messageId
func replaceIds(obj any) {
	switch v := obj.(type) {
	case map[string]any:
		if _, ok := v["messageId"]; ok {
			v["messageId"] = "test-uuid"
		}
		for _, val := range v {
			replaceIds(val)
		}
	case []any:
		for _, item := range v {
			replaceIds(item)
		}
	}
}
