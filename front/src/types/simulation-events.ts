import type { components } from "@/api/v1";

export type MessageType =
	| "SimulationInit"
	| "NextInternalTimeReport"
	| "ExecuteTransition"
	| "TransitionComplete"
	| "RequestOutput"
	| "OutputReport"
	| "SimulationTerminate"
	| "ModelTerminated"
	| "MonitoringMessage"
	| "ErrorReport";

export type KafkaMessagePortPayload = {
	portName: string;
	value: unknown;
};

type CommonKafkaMessage<TMessageType extends MessageType> = {
	messageType: TMessageType;
	messageId?: string;
	simulationRunId?: string;
	senderId?: string;
	receiverId?: string;
};

export type KafkaMessageSimulationInit =
	CommonKafkaMessage<"SimulationInit"> & {
		eventTime: number;
	};

export type KafkaMessageNextInternalTimeReport =
	CommonKafkaMessage<"NextInternalTimeReport"> & {
		eventTime: number;
		nextInternalTime: number;
	};

export type KafkaMessageExecuteTransition =
	CommonKafkaMessage<"ExecuteTransition"> & {
		eventTime: number;
		payload: {
			inputs: KafkaMessagePortPayload[] | null;
		};
	};

export type KafkaMessageTransitionComplete =
	CommonKafkaMessage<"TransitionComplete"> & {
		eventTime: number;
		nextInternalTime: number;
	};

export type KafkaMessageRequestOutput = CommonKafkaMessage<"RequestOutput"> & {
	eventTime: number;
};

export type KafkaMessageOutputReport = CommonKafkaMessage<"OutputReport"> & {
	eventTime: number;
	nextInternalTime: number;
	payload: {
		outputs: KafkaMessagePortPayload[] | null;
		additionalFields?: Record<string, unknown>;
	};
};

export type KafkaMessageSimulationTerminate =
	CommonKafkaMessage<"SimulationTerminate"> & {
		eventTime: number;
		payload?: {
			reason: string;
		};
	};

export type KafkaMessageModelTerminated = CommonKafkaMessage<"ModelTerminated">;

export type KafkaMessageMonitoringMessage =
	CommonKafkaMessage<"MonitoringMessage"> & {
		eventTime: number;
		payload: {
			category: "stateSnapshot" | "metric" | "trace" | "debug";
			values: Record<string, unknown>;
			sourceRole?: string;
		};
	};

export type KafkaMessageErrorReport = CommonKafkaMessage<"ErrorReport"> & {
	eventTime: number;
	payload: {
		originRole: "Coordinator" | "Runner" | "Other";
		originId: string;
		severity: "info" | "warning" | "error" | "fatal";
		errorCode: number;
		message: string;
		additionalFields?: Record<string, unknown>;
	};
};

export type KafkaMessage =
	| KafkaMessageSimulationInit
	| KafkaMessageNextInternalTimeReport
	| KafkaMessageExecuteTransition
	| KafkaMessageTransitionComplete
	| KafkaMessageRequestOutput
	| KafkaMessageOutputReport
	| KafkaMessageSimulationTerminate
	| KafkaMessageModelTerminated
	| KafkaMessageMonitoringMessage
	| KafkaMessageErrorReport;

type APISimulationEventResponse =
	components["schemas"]["response.SimulationEventResponse"];

export type SimulationEventResponse = Omit<
	APISimulationEventResponse,
	"message"
> & {
	message: KafkaMessage;
};

export type SimulationEventsResponse = Omit<
	components["schemas"]["response.SimulationEventsResponse"],
	"events"
> & {
	events?: SimulationEventResponse[];
};

export const getKafkaMessageEventTime = (
	message: KafkaMessage,
): number | null => {
	switch (message.messageType) {
		case "SimulationInit":
		case "NextInternalTimeReport":
		case "ExecuteTransition":
		case "TransitionComplete":
		case "RequestOutput":
		case "OutputReport":
		case "SimulationTerminate":
		case "MonitoringMessage":
		case "ErrorReport":
			return message.eventTime;
		case "ModelTerminated":
			return null;
	}
};
