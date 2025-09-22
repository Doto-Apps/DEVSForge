import type { components } from "@/api/v1";
import { LayoutDashboard, type LucideIcon } from "lucide-react";

type Workspace = {
	items: {
		title: string;
		url: string;
		id?: string;
		isActive?: boolean;
		items?: {
			icon?: LucideIcon;
			title: string;
			id?: string;
			url: string;
		}[];
	}[];
};

export function workspacesToFront(
	workspacesData: components["schemas"]["model.Workspace"][],
	diagramsData: components["schemas"]["model.Diagram"][],
): Workspace["items"] {
	return workspacesData.map((workspace) => ({
		title: workspace.title ?? "Sans titre",
		url: `/diagram/${workspace.id}`,
		id: workspace.id,
		isActive: false,
		items: diagramsData
			.filter((diagram) => diagram.workspaceId === workspace.id)
			.map((diagram) => ({
				icon: LayoutDashboard,
				title: diagram.name ?? "Untitled diagram",
				id: diagram.id,
				url: `/diagram/${diagram.id}`,
			})),
	}));
}
