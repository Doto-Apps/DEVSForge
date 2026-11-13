package lib_test

import (
	"devsforge/enum"
	"devsforge/lib"
	"devsforge/model"
	"encoding/json"
	"testing"
)

func TestGetDevsSympyJSON(t *testing.T) {
	models := []model.Model{{ID: "1", Name: "Example", Type: enum.Atomic}}

	result, err := lib.GetDevsSympyJSON(models, "1")
	if err != nil {
		t.Fatalf("Erreur dans la fonction: %v", err)
	}

	if len(result.Cells) != 1 || result.Cells[0].Type != "devs.Atomic" || result.Cells[0].Behavior.PythonPath != "1.py" {
		t.Fatalf("invalid atomic export: %+v", result)
	}
	_, err = json.Marshal(result)
	if err != nil {
		t.Fatalf("Erreur de sérialisation : %v", err)
	}

	if _, err = lib.GetDevsSympyJSON(nil, "1"); err == nil || err.Error() != "NOT_FOUND" {
		t.Fatalf("missing root should be rejected: %v", err)
	}
}
