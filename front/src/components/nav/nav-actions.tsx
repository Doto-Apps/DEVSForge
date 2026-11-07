"use client";

import {
	ArrowDown,
	ArrowUp,
	Bell,
	Copy,
	CornerUpLeft,
	CornerUpRight,
	FileText,
	GalleryVerticalEnd,
	LineChart,
	Link,
	MonitorPlay,
	MoreHorizontal,
	Play,
	Save,
	Settings2,
	ShieldCheck,
	Trash,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { client } from "@/api/client";
import type { components } from "@/api/v1";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = [
	{
		id: "main",
		menu: [
			{
				icon: Settings2,
				label: "More action coming up !",
			},
		],
	},
	{
		id: "first",
		menu: [
			{
				icon: Link,
				label: "Other actions",
			},
		],
	},
];

type NavActionsProps = {
	saveFunction?: () => Promise<void>;
	simulateFunction?: () => Promise<void>;
	validateFunction?: () => Promise<void>;
	deployFunction?: () => Promise<void>;
	modelId: components["schemas"]["model.Model"]["id"];
};

export function NavActions({
	saveFunction,
	simulateFunction,
	validateFunction,
	deployFunction,
	modelId,
}: NavActionsProps) {
	const [isOpen, setIsOpen] = React.useState(false);

	const handleExportManifest = async () => {
		if (modelId) {
			const res = await client.GET("/model/{id}/manifest", {
				params: {
					path: {
						id: modelId,
					},
				},
			});
			if (res.data?.manifest) {
				console.log(res.data.manifest);
				// const blob = new Blob([JSON.stringify(res.data.manifest, null, 2)], {
				// 	type: "application/json",
				// });
				// const url = URL.createObjectURL(blob);
				// const a = document.createElement("a");
				// a.href = url;
				// a.download = `manifest-${modelId}.json`;
				// a.click();
				// URL.revokeObjectURL(url);
			}
		}
	};

	return (
		<div className="flex items-center gap-2 text-sm">
			{validateFunction && (
				<Button
					className="size-7 xl:w-auto xl:px-2"
					onClick={validateFunction}
					size="icon"
					aria-label="Validate"
					title="Validate"
				>
					<ShieldCheck />
					<span className="hidden xl:inline">Validate</span>
				</Button>
			)}
			{deployFunction && (
				<Button
					className="size-7 xl:w-auto xl:px-2"
					onClick={deployFunction}
					size="icon"
					aria-label="Deploy"
					title="Deploy"
				>
					<MonitorPlay />
					<span className="hidden xl:inline">Deploy</span>
				</Button>
			)}
			{simulateFunction && (
				<Button
					className="size-7 xl:w-auto xl:px-2"
					onClick={simulateFunction}
					size="icon"
					aria-label="Simulate"
					title="Simulate"
				>
					<Play />
					<span className="hidden xl:inline">Simulate</span>
				</Button>
			)}
			{saveFunction && (
				<Button
					className="size-7 xl:w-auto xl:px-2"
					onClick={saveFunction}
					size="icon"
					aria-label="Save"
					title="Save"
				>
					<Save />
					<span className="hidden xl:inline">Save</span>
				</Button>
			)}

			<Popover onOpenChange={setIsOpen} open={isOpen}>
				<PopoverTrigger asChild>
					<Button
						aria-label="More actions"
						title="More actions"
						className="size-7 data-[state=open]:bg-accent"
						size="icon"
						variant="ghost"
					>
						<MoreHorizontal />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					className="w-56 overflow-hidden rounded-lg p-0"
				>
					<Sidebar className="bg-transparent" collapsible="none">
						<SidebarContent>
							{data.map((group) => (
								<SidebarGroup
									className="border-b last:border-none"
									key={group.id}
								>
									<SidebarGroupContent className="gap-0">
										<SidebarMenu>
											{group.menu.map((item) => (
												<SidebarMenuItem key={`${group.id}-${item.label}`}>
													<SidebarMenuButton>
														<item.icon /> <span>{item.label}</span>
													</SidebarMenuButton>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							))}
							<SidebarGroup>
								<SidebarGroupContent className="gap-0">
									<SidebarMenu>
										<SidebarMenuItem>
											<SidebarMenuButton onClick={handleExportManifest}>
												<ArrowDown /> Export Manifest
											</SidebarMenuButton>
										</SidebarMenuItem>
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</SidebarContent>
					</Sidebar>
				</PopoverContent>
			</Popover>
		</div>
	);
}
