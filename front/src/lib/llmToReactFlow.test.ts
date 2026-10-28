//@ts-nocheck

import { assert, describe, it } from "vitest";
import type { LLMDiagramResponse, ReactFlowInput } from "@/types";
import {
	createAtomicModelRequests,
	createCoupledModelRequest,
	createCoupledModelRequests,
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

	it("should include language in generated model save requests", () => {
		const diagram = {
			connections: [
				{
					from: { model: "system", port: "tick" },
					to: { model: "sensor", port: "tick" },
				},
				{
					from: { model: "sensor", port: "value" },
					to: { model: "system", port: "value" },
				},
			],
			models: [
				{
					code: "package main",
					codeGenerated: true,
					components: [],
					dependencies: [],
					id: "sensor",
					language: "go",
					name: "Sensor",
					ports: { in: ["tick"], out: ["value"] },
					type: "atomic",
				},
				{
					codeGenerated: false,
					components: ["Sensor"],
					dependencies: ["sensor"],
					id: "system",
					name: "System",
					ports: { in: ["tick"], out: ["value"] },
					type: "coupled",
				},
			],
			name: "GoSystem",
		};

		const { requests: atomicRequests } = createAtomicModelRequests(
			diagram,
			"library-id",
		);
		assert.equal(atomicRequests[0].language, "go");
		assert.equal(atomicRequests[0].ports[0].name, "tick");

		const coupledRequests = createCoupledModelRequests(
			diagram,
			"library-id",
			new Map([["Sensor", "db-sensor"]]),
		);
		assert.equal(coupledRequests[0].language, "go");
		assert.equal(coupledRequests[0].ports[0].name, "tick");
		assert.equal(coupledRequests[0].ports[1].name, "value");
		assert.lengthOf(coupledRequests[0].connections, 2);

		const sensorInstanceId = coupledRequests[0].components[0].instanceId;
		assert.deepInclude(coupledRequests[0].connections, {
			from: { instanceId: "root", port: "tick" },
			to: { instanceId: sensorInstanceId, port: "tick" },
		});
		assert.deepInclude(coupledRequests[0].connections, {
			from: { instanceId: sensorInstanceId, port: "value" },
			to: { instanceId: "root", port: "value" },
		});
	});

	it("should keep an empty coupled model as a root component when it has a database id", () => {
		const diagram = {
			connections: [
				{
					from: { model: "ScenarioGenerator", port: "entrance_out" },
					to: { model: "CorridorControlSystem", port: "entrance_presence" },
				},
				{
					from: { model: "ScenarioGenerator", port: "exit_out" },
					to: { model: "CorridorControlSystem", port: "exit_presence" },
				},
				{
					from: { model: "ScenarioGenerator", port: "control_out" },
					to: { model: "CorridorAcceptor", port: "control_in" },
				},
				{
					from: { model: "CorridorControlSystem", port: "routed_event" },
					to: { model: "CorridorAcceptor", port: "event_in" },
				},
				{
					from: { model: "CorridorControlSystem", port: "light_state" },
					to: { model: "CorridorAcceptor", port: "light_in" },
				},
				{
					from: { model: "CorridorControlSystem", port: "vent_state" },
					to: { model: "CorridorAcceptor", port: "vent_in" },
				},
				{
					from: { model: "CorridorAcceptor", port: "report_out" },
					to: { model: "CorridorExperimentalFrame", port: "validation_report" },
				},
			],
			models: [
				{
					codeGenerated: true,
					components: [],
					dependencies: [],
					id: "scenario",
					name: "ScenarioGenerator",
					ports: { in: [], out: ["entrance_out", "exit_out", "control_out"] },
					type: "atomic",
				},
				{
					codeGenerated: false,
					components: [],
					dependencies: [],
					id: "mut",
					name: "CorridorControlSystem",
					ports: {
						in: ["entrance_presence", "exit_presence"],
						out: ["routed_event", "light_state", "vent_state"],
					},
					type: "coupled",
				},
				{
					codeGenerated: true,
					components: [],
					dependencies: [],
					id: "acceptor",
					name: "CorridorAcceptor",
					ports: {
						in: ["control_in", "event_in", "light_in", "vent_in"],
						out: ["report_out"],
					},
					type: "atomic",
				},
				{
					codeGenerated: false,
					components: [
						"ScenarioGenerator",
						"CorridorControlSystem",
						"CorridorAcceptor",
					],
					dependencies: [],
					id: "ef",
					name: "CorridorExperimentalFrame",
					ports: { in: [], out: ["validation_report"] },
					type: "coupled",
				},
			],
			name: "CorridorExperimentalFrame",
		};

		const request = createCoupledModelRequest(
			diagram,
			"library-id",
			new Map([
				["ScenarioGenerator", "db-scenario"],
				["CorridorControlSystem", "db-mut"],
				["CorridorAcceptor", "db-acceptor"],
			]),
			diagram.models.find((model) => model.id === "ef"),
		);

		assert.lengthOf(request.components, 3);
		assert.isDefined(
			request.components.find((component) => component.modelId === "db-mut"),
		);
		assert.lengthOf(request.connections, 7);

		const mutInstanceId = request.components.find(
			(component) => component.modelId === "db-mut",
		)?.instanceId;
		assert.deepInclude(request.connections, {
			from: { instanceId: mutInstanceId, port: "light_state" },
			to: {
				instanceId: request.components.find(
					(component) => component.modelId === "db-acceptor",
				)?.instanceId,
				port: "light_in",
			},
		});
		assert.deepInclude(request.connections, {
			from: {
				instanceId: request.components.find(
					(component) => component.modelId === "db-acceptor",
				)?.instanceId,
				port: "report_out",
			},
			to: { instanceId: "root", port: "validation_report" },
		});
	});
});
