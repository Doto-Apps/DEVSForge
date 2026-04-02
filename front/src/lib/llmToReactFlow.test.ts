//@ts-nocheck

import { assert, describe, it } from "vitest";
import type { LLMDiagramResponse, ReactFlowInput } from "@/types";
import {
	generatedDiagramToReactFlow,
	llmResponseToGeneratedDiagram,
} from "./llmToReactFlow";

const inputDiagram: LLMDiagramResponse = {
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
	models: [
		{
			components: ["sun_detector", "battery", "controller", "panel_motor"],
			id: "SatellitePowerSystem",
			ports: [
				{
					id: "SatellitePowerSystem-control_signal",
					name: "control_signal",
					type: "out",
				},
			],
			type: "coupled",
		},
		{
			components: [],
			id: "sun_detector",
			ports: [
				{
					id: "sun_detector-sun_presence",
					name: "sun_presence",
					type: "out",
				},
			],
			type: "atomic",
		},
		{
			components: [],
			id: "battery",
			ports: [
				{
					id: "battery-battery_level",
					name: "battery_level",
					type: "out",
				},
			],
			type: "atomic",
		},
		{
			components: [],
			id: "controller",
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
			type: "atomic",
		},
		{
			components: [],
			id: "panel_motor",
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
			type: "atomic",
		},
	],
};

const expectedReactFlow: ReactFlowInput = {
	edges: [
		{
			data: {
				holderId: "SatellitePowerSystem",
			},
			id: "SatellitePowerSystem/sun_detector:sun_presence->SatellitePowerSystem/controller:sun_presence",
			source: "SatellitePowerSystem/sun_detector",
			sourceHandle: "SatellitePowerSystem/sun_detector:sun_presence",
			target: "SatellitePowerSystem/controller",
			targetHandle: "SatellitePowerSystem/controller:sun_presence",
		},
		{
			data: {
				holderId: "SatellitePowerSystem",
			},
			id: "SatellitePowerSystem/battery:battery_level->SatellitePowerSystem/controller:battery_level",
			source: "SatellitePowerSystem/battery",
			sourceHandle: "SatellitePowerSystem/battery:battery_level",
			target: "SatellitePowerSystem/controller",
			targetHandle: "SatellitePowerSystem/controller:battery_level",
		},
		{
			data: {
				holderId: "SatellitePowerSystem",
			},
			id: "SatellitePowerSystem/controller:motor_command->SatellitePowerSystem/panel_motor:motor_command",
			source: "SatellitePowerSystem/controller",
			sourceHandle: "SatellitePowerSystem/controller:motor_command",
			target: "SatellitePowerSystem/panel_motor",
			targetHandle: "SatellitePowerSystem/panel_motor:motor_command",
		},
		{
			data: {
				holderId: "SatellitePowerSystem",
			},
			id: "SatellitePowerSystem/panel_motor:motor_feedback->SatellitePowerSystem/controller:motor_feedback",
			source: "SatellitePowerSystem/panel_motor",
			sourceHandle: "SatellitePowerSystem/panel_motor:motor_feedback",
			target: "SatellitePowerSystem/controller",
			targetHandle: "SatellitePowerSystem/controller:motor_feedback",
		},
		{
			data: {
				holderId: "SatellitePowerSystem",
			},
			id: "SatellitePowerSystem/controller:control_signal->SatellitePowerSystem:control_signal",
			source: "SatellitePowerSystem/controller",
			sourceHandle: "SatellitePowerSystem/controller:control_signal",
			target: "SatellitePowerSystem",
			targetHandle: "internal-SatellitePowerSystem:control_signal",
		},
	],
	nodes: [
		{
			data: {
				code: "",
				id: "SatellitePowerSystem",
				inputPorts: [],
				label: "SatellitePowerSystem",
				modelType: "coupled",
				outputPorts: [{ id: "control_signal", name: "control_signal" }],
				parameters: [],
			},
			deletable: false,
			dragging: false,
			height: 1000,
			id: "SatellitePowerSystem",
			measured: { height: 1000, width: 1000 },
			position: { x: 0, y: 0 },
			selected: false,
			type: "resizer",
			width: 1000,
		},
		{
			data: {
				code: "",
				id: "sun_detector",
				inputPorts: [],
				label: "sun_detector",
				modelType: "atomic",
				outputPorts: [{ id: "sun_presence", name: "sun_presence" }],
				parameters: [],
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "SatellitePowerSystem/sun_detector",
			measured: { height: 200, width: 200 },
			parentId: "SatellitePowerSystem",
			position: { x: 250, y: 250 },
			selected: false,
			type: "resizer",
			width: 200,
		},
		{
			data: {
				code: "",
				id: "battery",
				inputPorts: [],
				label: "battery",
				modelType: "atomic",
				outputPorts: [{ id: "battery_level", name: "battery_level" }],
				parameters: [],
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "SatellitePowerSystem/battery",
			measured: { height: 200, width: 200 },
			parentId: "SatellitePowerSystem",
			position: { x: 500, y: 250 },
			selected: false,
			type: "resizer",
			width: 200,
		},
		{
			data: {
				code: "",
				id: "panel_motor",
				inputPorts: [{ id: "motor_command", name: "motor_command" }],
				label: "panel_motor",
				modelType: "atomic",
				outputPorts: [{ id: "motor_feedback", name: "motor_feedback" }],
				parameters: [],
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "SatellitePowerSystem/panel_motor",
			measured: { height: 200, width: 200 },
			parentId: "SatellitePowerSystem",
			position: { x: 750, y: 250 },
			selected: false,
			type: "resizer",
			width: 200,
		},
		{
			data: {
				code: "",
				id: "controller",
				inputPorts: [
					{ id: "sun_presence", name: "sun_presence" },
					{ id: "battery_level", name: "battery_level" },
					{ id: "motor_feedback", name: "motor_feedback" },
				],
				label: "controller",
				modelType: "atomic",
				outputPorts: [
					{ id: "motor_command", name: "motor_command" },
					{ id: "control_signal", name: "control_signal" },
				],
				parameters: [],
			},
			dragging: false,
			extent: "parent",
			height: 200,
			id: "SatellitePowerSystem/controller",
			measured: { height: 200, width: 200 },
			parentId: "SatellitePowerSystem",
			position: { x: 250, y: 500 },
			selected: false,
			type: "resizer",
			width: 200,
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
