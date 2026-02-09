package request

import "devsforge/model"

type ExperimentalFrameRequest struct {
	TargetModelID string `json:"targetModelId" validate:"required"`
	FrameModelID  string `json:"frameModelId" validate:"required"`
}

func (req ExperimentalFrameRequest) ToModel(userID string) model.ExperimentalFrame {
	return model.ExperimentalFrame{
		UserID:        userID,
		TargetModelID: req.TargetModelID,
		FrameModelID:  req.FrameModelID,
	}
}
