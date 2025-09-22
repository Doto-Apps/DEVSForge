package enum

import (
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// ModelType définit les valeurs possibles pour le type de modèle
type ModelType string

const (
	Atomic  ModelType = "atomic"
	Coupled ModelType = "coupled"
)

// GormDBType retourne le type ENUM pour Gorm (PostgreSQL)
func (ModelType) GormDBDataType(db *gorm.DB, field *schema.Field) string {
	return "model_type"
}
