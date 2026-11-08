import { describe, it, expect } from "vitest";
import {
	generatedDiagramToReactFlow,
	syncGeneratedStructure,
	validateGeneratedStructure,
	mergeStructureProposal,
	createCoupledModelRequest,
} from "./llmToReactFlow";
import type { GeneratedDiagram, GeneratedModelData } from "@/types";
const model = (id: string, components?: string[]): GeneratedModelData => ({
	id,
	name: id,
	type: components ? "coupled" : "atomic",
	components,
	ports: { in: ["in"], out: ["out"] },
	dependencies: [],
	codeGenerated: false,
});
const fixture = (): GeneratedDiagram => ({
	name: "nested",
	models: [
		model("root", ["sub", "sink"]),
		model("sub", ["inner"]),
		model("inner", ["leaf"]),
		model("leaf"),
		model("sink"),
	],
	connections: [
		{
			owner: "root",
			from: { model: "sub", port: "out" },
			to: { model: "sink", port: "in" },
		},
		{
			owner: "sub",
			from: { model: "inner", port: "out" },
			to: { model: "sub", port: "out" },
		},
		{
			owner: "inner",
			from: { model: "leaf", port: "out" },
			to: { model: "inner", port: "out" },
		},
		{
			owner: "inner",
			from: { model: "inner", port: "in" },
			to: { model: "leaf", port: "in" },
		},
	],
});
describe("nested generated structures", () => {
	it("renders real parents through three coupled levels and keeps scoped connections", () => {
		const d = fixture();
		expect(validateGeneratedStructure(d)).toEqual([]);
		const graph = generatedDiagramToReactFlow(d);
		expect(graph.edges.every((edge) => edge.type === "step")).toBe(true);
		expect(graph.nodes.find((n) => n.data.id === "leaf")?.parentId).toBe(
			"root/sub/inner",
		);
		expect(graph.nodes.find((n) => n.data.id === "inner")?.parentId).toBe(
			"root/sub",
		);
		expect(
			graph.edges.filter((e) => e.data?.holderId === "root/sub/inner"),
		).toHaveLength(2);
		const roundtrip = syncGeneratedStructure(d, graph);
		expect(roundtrip.models.find((m) => m.id === "root")?.components).toEqual([
			"sub",
			"sink",
		]);
		expect(roundtrip.models.find((m) => m.id === "inner")?.components).toEqual([
			"leaf",
		]);
		expect(roundtrip.connections.map((c) => JSON.stringify(c)).sort()).toEqual(
			d.connections.map((c) => JSON.stringify(c)).sort(),
		);
		expect(validateGeneratedStructure(roundtrip)).toEqual([]);
		const ids = new Map(d.models.map((m) => [m.id, "db-" + m.id]));
		const saved = createCoupledModelRequest(
			{ ...roundtrip, reactFlowData: graph },
			"library",
			ids,
			roundtrip.models.find((m) => m.id === "inner")!,
		);
		expect(saved.components?.[0]?.instanceMetadata?.position).toEqual(
			graph.nodes.find((n) => n.data.id === "leaf")?.position,
		);
	});
	it("saves boundary couplings at their owner and never drops missing components", () => {
		const d = fixture();
		validateGeneratedStructure(d);
		const ids = new Map(d.models.map((m) => [m.id, "db-" + m.id]));
		const request = createCoupledModelRequest(
			d,
			"library",
			ids,
			d.models.find((m) => m.id === "inner")!,
		);
		expect(request.connections).toHaveLength(2);
		expect(
			request.connections?.some((c) => c.from?.instanceId === "root"),
		).toBe(true);
		ids.delete("leaf");
		expect(() =>
			createCoupledModelRequest(
				d,
				"library",
				ids,
				d.models.find((m) => m.id === "inner")!,
			),
		).toThrow("Unknown component");
	});
	it("rejects cross-level wiring and containment cycles but allows DEVS feedback", () => {
		const d = fixture();
		d.connections.push({
			owner: "inner",
			from: { model: "leaf", port: "out" },
			to: { model: "leaf", port: "in" },
		});
		expect(validateGeneratedStructure(d)).toEqual([]);
		d.connections.push({
			owner: "root",
			from: { model: "leaf", port: "out" },
			to: { model: "sink", port: "in" },
		});
		expect(validateGeneratedStructure(d).join()).toContain("hierarchy");
		d.models.find((m) => m.id === "inner")!.components!.push("root");
		expect(validateGeneratedStructure(d).join()).toContain("Containment cycle");
	});
	it("requires explicit owners when definitions are reused in two coupled models", () => {
		const d: GeneratedDiagram = {
			name: "reuse",
			models: [
				model("root", ["a", "b"]),
				model("a", ["x", "y"]),
				model("b", ["x", "y"]),
				model("x"),
				model("y"),
			],
			connections: [
				{ from: { model: "x", port: "out" }, to: { model: "y", port: "in" } },
			],
		};
		expect(validateGeneratedStructure(d).join()).toContain("unambiguous");
		d.connections[0].owner = "a";
		expect(validateGeneratedStructure(d)).toEqual([]);
		const graph = generatedDiagramToReactFlow(d);
		expect(graph.nodes.filter((n) => n.data.id === "x")).toHaveLength(2);
		expect(graph.edges).toHaveLength(1);
	});
	it("preserves written code and flags interface changes for review", () => {
		const d = fixture();
		d.models.find((m) => m.id === "leaf")!.code = "my unsaved code";
		d.models.find((m) => m.id === "leaf")!.integrationId = "xdevs-python";
		const proposal = fixture();
		proposal.models.find((m) => m.id === "leaf")!.ports.in.push("extra");
		const merged = mergeStructureProposal(d, proposal);
		expect(merged.models.find((m) => m.id === "leaf")).toMatchObject({
			code: "my unsaved code",
			integrationId: "xdevs-python",
			needsRevalidation: true,
			codeGenerated: false,
		});
		expect(d.models.find((m) => m.id === "leaf")!.ports.in).toEqual(["in"]);
	});
});
