package response

import (
	"devsforge/model"
	"time"
)

type ExperimentalFrameResponse struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId"`
	TargetModelID string    `json:"targetModelId"`
	FrameModelID  string    `json:"frameModelId"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func CreateExperimentalFrameResponse(ef model.ExperimentalFrame) ExperimentalFrameResponse {
	return ExperimentalFrameResponse{
		ID:            ef.ID,
		UserID:        ef.UserID,
		TargetModelID: ef.TargetModelID,
		FrameModelID:  ef.FrameModelID,
		CreatedAt:     ef.CreatedAt,
		UpdatedAt:     ef.UpdatedAt,
	}
}
