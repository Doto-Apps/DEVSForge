import { assert, describe, it, vi } from "vitest";
import { mockReactFlowModelLibrary } from "@/lib/__tests__/fakeData";
import type { ReactFlowInput } from "@/types";

vi.mock("@/api/client", () => ({ client: {} }));
vi.mock("@/providers/AuthProvider", () => ({ useAuth: vi.fn() }));

import { refreshTabColors } from "./WorkbenchProvider";

function makeTab() {
	const draft: ReactFlowInput = {
		...mockReactFlowModelLibrary,
		nodes: mockReactFlowModelLibrary.nodes.map(
			({ selected, dragging, ...node }) => node,
		),
	};
	return {
		baseline: JSON.stringify(draft),
		draft,
		future: [draft],
		id: draft.nodes[0].id,
		kind: "coupled",
		libraryId: "library",
		libraryName: "Library",
		name: "House",
		past: [draft],
	};
}

describe("workbench colors", () => {
	it("refreshes recovered nested colors and undo snapshots without making a clean tab dirty", () => {
		const tab = makeTab();
		const colors = { bodyBackgroundColor: "#ff9200" };
		const incoming = {
			...tab.draft,
			nodes: tab.draft.nodes.map((node) => ({
				...node,
				data: { ...node.data, reactFlowModelGraphicalData: colors },
			})),
		};
		const result = refreshTabColors(tab, incoming);
		for (const graph of [result.draft, ...result.past, ...result.future]) {
			for (const node of graph.nodes) {
				assert.deepEqual(
					node.data.reactFlowModelGraphicalData,
					node.parentId ? colors : undefined,
				);
			}
		}
		assert.equal(JSON.stringify(result.draft), result.baseline);
		assert.equal(refreshTabColors(result, incoming), result);
		assert.equal(
			tab.draft.nodes[1].data.reactFlowModelGraphicalData,
			undefined,
		);
	});

	it("preserves unsaved code, root colors, layout, selection and viewport", () => {
		const tab = makeTab();
		const incoming = {
			...tab.draft,
			nodes: tab.draft.nodes.map((node) => ({
				...node,
				data: {
					...node.data,
					reactFlowModelGraphicalData: { bodyBackgroundColor: "#ff9200" },
				},
			})),
		};
		tab.draft = {
			...tab.draft,
			nodes: tab.draft.nodes.map((node) =>
				node.parentId
					? node
					: {
							...node,
							data: {
								...node.data,
								code: "unsaved code",
								reactFlowModelGraphicalData: { bodyBackgroundColor: "#0000ff" },
							},
							position: { x: 100, y: 200 },
							selected: true,
						},
			),
			viewport: { x: 20, y: 30, zoom: 1.5 },
		};
		const result = refreshTabColors(tab, incoming);
		assert.equal(result.draft.nodes[0], tab.draft.nodes[0]);
		assert.equal(result.draft.viewport, tab.draft.viewport);
		assert.equal(result.draft.edges, tab.draft.edges);
		assert.notEqual(JSON.stringify(result.draft), result.baseline);
		assert.notInclude(result.baseline, "unsaved code");
	});
});
