import { describe, expect, it } from "vitest";
import type { components } from "@/api/v1";
import { libraryPreview } from "./libraryPreview";

type Model = components["schemas"]["response.ModelResponse"];
const atomic: Model = {
	code: "",
	components: [],
	connections: [],
	description: "",
	id: "a",
	metadata: {
		keyword: [],
		modelRole: "",
		position: { x: 0, y: 0 },
		style: { height: 200, width: 200 },
	},
	name: "Same name",
	ports: [{ id: "out", name: "state", type: "out" }],
	type: "atomic",
	userId: "owner",
};
const parent: Model = {
	...atomic,
	components: [
		{ instanceId: "left", modelId: "a" },
		{ instanceId: "right", modelId: "a" },
	],
	connections: [
		{
			from: { instanceId: "left", port: "state" },
			to: { instanceId: "root", port: "state" },
		},
	],
	id: "parent",
	ports: [{ id: "external", name: "state", type: "out" }],
	type: "coupled",
};

describe("library previews", () => {
	it("keeps repeated definitions and copies in different previews distinct", () => {
		const graph = libraryPreview([atomic, parent], [atomic, parent]);
		expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(4);
		expect(
			graph.nodes.find((n) => n.id === "parent::parent/left")?.parentId,
		).toBe("parent::parent");
		expect(graph.edges[0].sourceHandle).toBe("parent::parent/left:state");
		expect(graph.edges[0].targetHandle).toBe("internal-parent::parent:state");
		const ids = graph.nodes.map((n) => n.id);
		expect(ids.indexOf("parent::parent")).toBeLessThan(
			ids.indexOf("parent::parent/left"),
		);
	});
	it("keeps originals unchanged while placing separate root previews", () => {
		const before = JSON.stringify([atomic, parent]);
		const graph = libraryPreview([atomic, parent], [atomic, parent]);
		expect(
			graph.nodes.find((n) => n.id === "parent::parent")?.position.x,
		).toBeGreaterThan(200);
		expect(JSON.stringify([atomic, parent])).toBe(before);
	});
	it("bounds cyclic or missing descendants without crashing the gallery", () => {
		const cyclic = {
			...parent,
			components: [{ instanceId: "self", modelId: "parent" }],
		};
		const missing = {
			...parent,
			components: [{ instanceId: "missing", modelId: "unknown" }],
		};
		for (const model of [cyclic, missing]) {
			const graph = libraryPreview([model], [model]);
			expect(graph.nodes).toHaveLength(1);
			expect(graph.edges).toHaveLength(0);
			expect(graph.nodes[0].data.description).toContain("unavailable");
		}
	});
});
