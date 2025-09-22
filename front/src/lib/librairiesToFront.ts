import type { components } from "@/api/v1";
import { LayoutDashboard, type LucideIcon, Square } from "lucide-react";

type Library = {
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

export function librairiesToFront(
	libraryData: components["schemas"]["model.Library"][],
	modelData: components["schemas"]["response.ModelResponse"][],
): Library["items"] {
	return libraryData.map((lib) => ({
		title: lib.title ?? "Sans titre",
		url: `/library/${lib.id}`,
		id: lib.id,
		isActive: false,
		items: modelData
			.filter((model) => model.libId === lib.id)
			.map((model) => ({
				icon: model.type === "atomic" ? Square : LayoutDashboard,
				title: model.name ?? "Modèle sans titre",
				id: model.id,
				url: `/model/${model.id}`,
			})),
	}));
}
