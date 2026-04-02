import type { LLMDiagramResponse, ReactFlowInput } from "@/types";
import { assert, describe, it } from "vitest";
import {
	generatedDiagramToReactFlow,
	llmResponseToGeneratedDiagram,
} from "./llmToReactFlow";

const inputDiagram: LLMDiagramResponse = {
	models: [
		{
			id: "SatellitePowerSystem",
			type: "coupled",
			ports: [
				{
					id: "SatellitePowerSystem-control_signal",
					name: "control_signal",
					type: "out",
				},
			],
			components: ["sun_detector", "battery", "controller", "panel_motor"],
		},
		{
			id: "sun_detector",
			type: "atomic",
			ports: [
				{
					id: "sun_detector-sun_presence",
					name: "sun_presence",
					type: "out",
				},
			],
			components: [],
		},
		{
			id: "battery",
			type: "atomic",
			ports: [
				{
					id: "battery-battery_level",
					name: "battery_level",
					type: "out",
				},
			],
			components: [],
		},
		{
			id: "controller",
			type: "atomic",
			ports: [
				{
					id: "controller-sun_presence",
					name: "sun_presence",
					type: "in",
				},
				{
					id: "controller-battery_level",
					name: "battery_level",
					type: "in",
				},
				{
					id: "controller-motor_feedback",
					name: "motor_feedback",
					type: "in",
				},
				{
					id: "controller-motor_command",
					name: "motor_command",
					type: "out",
				},
				{
					id: "controller-control_signal",
					name: "control_signal",
					type: "out",
				},
			],
			components: [],
		},
		{
			id: "panel_motor",
			type: "atomic",
			ports: [
				{
					id: "panel_motor-motor_command",
					name: "motor_command",
					type: "in",
				},
				{
					id: "panel_motor-motor_feedback",
					name: "motor_feedback",
					type: "out",
				},
			],
			components: [],
		},
	],
	connections: [
		{
			from: { model: "sun_detector", port: "sun_presence" },
			to: { model: "controller", port: "sun_presence" },
		},
		{
			from: { model: "battery", port: "battery_level" },
			to: { model: "controller", port: "battery_level" },
		},
		{
			from: { model: "controller", port: "motor_command" },
			to: { model: "panel_motor", port: "motor_command" },
		},
		{
			from: { model: "panel_motor", port: "motor_feedback" },
			to: { model: "controller", port: "motor_feedback" },
		},
		{
			from: { model: "controller", port: "control_signal" },
			to: { model: "SatellitePowerSystem", port: "control_signal" },
		},
	],
};

const expectedReactFlow: ReactFlowInput = {
	nodes: [
		{
			id: "SatellitePowerSystem",
			type: "resizer",
			position: { x: 0, y: 0 },
			measured: { height: 1000, width: 1000 },
			height: 1000,
			width: 1000,
			data: {
				id: "SatellitePowerSystem",
				modelType: "coupled",
				label: "SatellitePowerSystem",
				inputPorts: [],
				outputPorts: [{ id: "control_signal", name: "control_signal" }],
				code: "",
				parameters: [],
			},
			dragging: false,
			selected: false,
			deletable: false,
		},
		{
			id: "SatellitePowerSystem/sun_detector",
			type: "resizer",
			position: { x: 250, y: 250 },
			measured: { height: 200, width: 200 },
			height: 200,
			width: 200,
			data: {
				id: "sun_detector",
				modelType: "atomic",
				label: "sun_detector",
				inputPorts: [],
				outputPorts: [{ id: "sun_presence", name: "sun_presence" }],
				code: "",
				parameters: [],
			},
			dragging: false,
			selected: false,
			extent: "parent",
			parentId: "SatellitePowerSystem",
		},
		{
			id: "SatellitePowerSystem/battery",
			type: "resizer",
			position: { x: 500, y: 250 },
			measured: { height: 200, width: 200 },
			height: 200,
			width: 200,
			data: {
				id: "battery",
				modelType: "atomic",
				label: "battery",
				inputPorts: [],
				outputPorts: [{ id: "battery_level", name: "battery_level" }],
				code: "",
				parameters: [],
			},
			dragging: false,
			selected: false,
			extent: "parent",
			parentId: "SatellitePowerSystem",
		},
		{
			id: "SatellitePowerSystem/panel_motor",
			type: "resizer",
			position: { x: 750, y: 250 },
			measured: { height: 200, width: 200 },
			height: 200,
			width: 200,
			data: {
				id: "panel_motor",
				modelType: "atomic",
				label: "panel_motor",
				inputPorts: [{ id: "motor_command", name: "motor_command" }],
				outputPorts: [{ id: "motor_feedback", name: "motor_feedback" }],
				code: "",
				parameters: [],
			},
			dragging: false,
			selected: false,
			extent: "parent",
			parentId: "SatellitePowerSystem",
		},
		{
			id: "SatellitePowerSystem/controller",
			type: "resizer",
			position: { x: 250, y: 500 },
			measured: { height: 200, width: 200 },
			height: 200,
			width: 200,
			data: {
				id: "controller",
				modelType: "atomic",
				label: "controller",
				inputPorts: [
					{ id: "sun_presence", name: "sun_presence" },
					{ id: "battery_level", name: "battery_level" },
					{ id: "motor_feedback", name: "motor_feedback" },
				],
				outputPorts: [
					{ id: "motor_command", name: "motor_command" },
					{ id: "control_signal", name: "control_signal" },
				],
				code: "",
				parameters: [],
			},
			dragging: false,
			selected: false,
			extent: "parent",
			parentId: "SatellitePowerSystem",
		},
	],
	edges: [
		{
			id: "SatellitePowerSystem/sun_detector:sun_presence->SatellitePowerSystem/controller:sun_presence",
			source: "SatellitePowerSystem/sun_detector",
			target: "SatellitePowerSystem/controller",
			sourceHandle: "SatellitePowerSystem/sun_detector:sun_presence",
			targetHandle: "SatellitePowerSystem/controller:sun_presence",
			data: {
				holderId: "SatellitePowerSystem",
			},
		},
		{
			id: "SatellitePowerSystem/battery:battery_level->SatellitePowerSystem/controller:battery_level",
			source: "SatellitePowerSystem/battery",
			target: "SatellitePowerSystem/controller",
			sourceHandle: "SatellitePowerSystem/battery:battery_level",
			targetHandle: "SatellitePowerSystem/controller:battery_level",
			data: {
				holderId: "SatellitePowerSystem",
			},
		},
		{
			id: "SatellitePowerSystem/controller:motor_command->SatellitePowerSystem/panel_motor:motor_command",
			source: "SatellitePowerSystem/controller",
			target: "SatellitePowerSystem/panel_motor",
			sourceHandle: "SatellitePowerSystem/controller:motor_command",
			targetHandle: "SatellitePowerSystem/panel_motor:motor_command",
			data: {
				holderId: "SatellitePowerSystem",
			},
		},
		{
			id: "SatellitePowerSystem/panel_motor:motor_feedback->SatellitePowerSystem/controller:motor_feedback",
			source: "SatellitePowerSystem/panel_motor",
			target: "SatellitePowerSystem/controller",
			sourceHandle: "SatellitePowerSystem/panel_motor:motor_feedback",
			targetHandle: "SatellitePowerSystem/controller:motor_feedback",
			data: {
				holderId: "SatellitePowerSystem",
			},
		},
		{
			id: "SatellitePowerSystem/controller:control_signal->SatellitePowerSystem:control_signal",
			source: "SatellitePowerSystem/controller",
			target: "SatellitePowerSystem",
			sourceHandle: "SatellitePowerSystem/controller:control_signal",
			targetHandle: "internal-SatellitePowerSystem:control_signal",
			data: {
				holderId: "SatellitePowerSystem",
			},
		},
	],
};

describe("llmToReactFlow", () => {
	it("should convert llm diagram response to reactflow nodes", () => {
		const diagram = llmResponseToGeneratedDiagram(inputDiagram, "satellite");
		const result = generatedDiagramToReactFlow(diagram);

		assert.deepEqual(
			[...result.nodes].sort((a, b) => a.id.localeCompare(b.id)),
			[...expectedReactFlow.nodes].sort((a, b) => a.id.localeCompare(b.id)),
		);
	});

	it("should convert llm diagram response to reactflow edges", () => {
		const diagram = llmResponseToGeneratedDiagram(inputDiagram, "satellite");
		const result = generatedDiagramToReactFlow(diagram);

		assert.deepEqual(
			[...result.edges].sort((a, b) => a.id.localeCompare(b.id)),
			[...expectedReactFlow.edges].sort((a, b) => a.id.localeCompare(b.id)),
		);
	});
});
