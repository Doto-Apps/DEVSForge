package lib_test

import (
	"devsforge/back/lib"
	"devsforge/back/model"
	"encoding/json"
	"testing"
)

func TestGetDevsSympyJSON(t *testing.T) {
	// expectedJSON := ``
	expected := []model.Model{}

	result, err := lib.GetDevsSympyJSON(expected, "1")
	if err != nil {
		t.Fatalf("Erreur dans la fonction: %v", err)
	}

	// actualJSONBytes, err := json.Marshal(result)
	_, err = json.Marshal(result)
	if err != nil {
		t.Fatalf("Erreur de sérialisation : %v", err)
	}

	// var expectedObj, actualObj interface{}
	// _ = json.Unmarshal([]byte(expectedJSON), &expectedObj)
	// _ = json.Unmarshal(actualJSONBytes, &actualObj)

	// if !reflect.DeepEqual(expectedObj, actualObj) {
	// 	t.Errorf("Le JSON retourné ne correspond pas.\nAttendu: %v\nObtenu: %v", expectedObj, actualObj)
	// }
}
