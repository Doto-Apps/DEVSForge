import { describe, expect, it } from "vitest";
import type { GeneratedDiagram, GeneratedModelData } from "@/types";
import { generatedDiagramToReactFlow } from "./llmToReactFlow";
import { getLayoutedElements } from "./getLayoutedElements";

const model = (id: string, children?: string[]): GeneratedModelData => ({
	id,
	name: id,
	type: children ? "coupled" : "atomic",
	components: children,
	ports: { in: ["general", "local"], out: ["state"] },
	dependencies: [],
	codeGenerated: false,
});

describe("nested automatic layout", () => {
	it("reserves the header and a margin at every coupled level, including boundary couplings", async () => {
		const diagram: GeneratedDiagram = {
			name: "Home",
			models: [
				model("Home", ["Room1", "Room2", "GeneralSwitch"]),
				model("Room1", ["Switch1", "Light1"]),
				model("Room2", ["Switch2", "Light2"]),
				model("GeneralSwitch"),
				model("Switch1"),
				model("Light1"),
				model("Switch2"),
				model("Light2"),
			],
			connections: ["1", "2"].flatMap((room) => [
				{
					owner: "Home",
					from: { model: "GeneralSwitch", port: "state" },
					to: { model: `Room${room}`, port: "general" },
				},
				{
					owner: `Room${room}`,
					from: { model: `Room${room}`, port: "general" },
					to: { model: `Light${room}`, port: "general" },
				},
				{
					owner: `Room${room}`,
					from: { model: `Switch${room}`, port: "state" },
					to: { model: `Light${room}`, port: "local" },
				},
			]),
		};
		const graph = generatedDiagramToReactFlow(diagram);
		const before = JSON.stringify(graph);
		const layout = await getLayoutedElements(graph.nodes, graph.edges);
		expect(layout.nodes).toHaveLength(8);
		for (const child of layout.nodes.filter((node) => node.parentId)) {
			const parent = layout.nodes.find((node) => node.id === child.parentId)!;
			expect(child.position.y).toBeGreaterThanOrEqual(40 + 16);
			expect(child.position.x).toBeGreaterThanOrEqual(16);
			expect(child.position.y + child.height! + 16).toBeLessThanOrEqual(
				parent.height!,
			);
			expect(child.position.x + child.width! + 16).toBeLessThanOrEqual(
				parent.width!,
			);
		}
		expect(layout.edges).toEqual(graph.edges);
		expect(JSON.stringify(graph)).toEqual(before);
	});
});
