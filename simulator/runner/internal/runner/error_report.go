package runner

import (
	"devsforge-shared/kafka"
)

func (r *Runner) SendErrorReport(errorCode int64, sourceErr error) error {
	msg := r.GetBaseKafkaMessage(kafka.CoordinatorId).NewKafkaMessageErrorReport(kafka.KafkaMessageErrorReportParams{
		EventTime: r.CurrentTime,
		Payload: kafka.KafkaMessageErrorReportPayload{
			OriginRole:       kafka.KafkaMessageErrorReportPayloadOriginRoleRunner,
			OriginID:         r.Config.Model.ID,
			Severity:         kafka.KafkaMessageErrorReportPayloadSeverityFatal,
			ErrorCode:        errorCode,
			Message:          sourceErr.Error(),
			AdditionalFields: &map[string]any{},
		},
	})

	return r.SendMessage(msg)
}
