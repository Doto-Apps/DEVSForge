package services

import (
	"devsforge/back/database"
	"devsforge/back/model"
	"errors"
)

func GetModelRecursice(id string, userId string) (models []model.Model, err error) {
	db := database.DB

	modelIds := make([]string, 0)
	modelIds = append(modelIds, id)
	models = make([]model.Model, 0)

	for len(modelIds) > 0 {
		var model model.Model

		flag := false

		for _, v := range models {
			if v.ID == modelIds[0] {
				flag = true
			}
		}
		if !flag {
			db.Find(&model, "user_id = ? AND id = ?", userId, modelIds[0])
			if model.Name == "" {
				return nil, errors.New("MODEL_NOT_FOUND")
			} else {
				models = append(models, model)
				for _, v := range model.Components {
					modelIds = append(modelIds, v.ModelID)
				}
			}
		}
		modelIds = modelIds[1:]
	}

	return models, nil
}
