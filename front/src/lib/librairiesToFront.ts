import {
	CheckCircle2,
	GaugeCircle,
	LayoutDashboard,
	type LucideIcon,
	ShieldCheck,
	Shuffle,
	Square,
} from "lucide-react";
import type { ComponentType } from "react";
import type { components } from "@/api/v1";

type SidebarIcon = ComponentType<{ className?: string }>;

type Library = {
	items: {
		title: string;
		url: string;
		id?: string;
		isActive?: boolean;
		items?: {
			icon?: SidebarIcon;
			title: string;
			id?: string;
			url: string;
		}[];
	}[];
};

const roleIconMap: Record<string, LucideIcon> = {
	acceptor: CheckCircle2,
	"experimental-frame": ShieldCheck,
	generator: GaugeCircle,
	transducer: Shuffle,
};

const getModelIcon = (
	model: components["schemas"]["response.ModelResponse"],
): SidebarIcon => {
	const role = model.metadata.modelRole?.toLowerCase?.();
	if (role && roleIconMap[role]) return roleIconMap[role];
	return model.type === "atomic" ? Square : LayoutDashboard;
};

export function librairiesToFront(
	libraryData: components["schemas"]["model.Library"][],
	modelData: components["schemas"]["response.ModelResponse"][],
): Library["items"] {
	return libraryData.map((lib) => ({
		id: lib.id,
		isActive: false,
		items: modelData
			.filter((model) => model.libId === lib.id)
			.map((model) => ({
				icon: getModelIcon(model),
				id: model.id,
				title: model.name ?? "Modele sans titre",
				url: `/model/${model.id}`,
			})),
		title: lib.title ?? "Sans titre",
		url: `/library/${lib.id}`,
	}));
}
