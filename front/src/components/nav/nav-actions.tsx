"use client";

import {
	ArrowDown,
	Link,
	MonitorPlay,
	MoreHorizontal,
	Play,
	Save,
	Settings2,
	ShieldCheck,
} from "lucide-react";
import * as React from "react";
import { client, useQuery } from "@/api/client";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

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
	const { data: capability, error: capabilityError } = useQuery(
		"/model/{id}/capabilities",
		modelId ? { params: { path: { id: modelId } } } : null,
	);
	const blockedReason = modelId
		? capabilityError
			? "Execution availability could not be checked."
			: capability?.simulation
				? ""
				: capability?.reason || "Checking execution availability…"
		: "";

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
				<ExecutionHint reason={blockedReason}>
					<Button
						aria-label="Validate"
						className="size-7 xl:w-auto xl:px-2"
						disabled={!!blockedReason}
						onClick={validateFunction}
						size="icon"
						title="Validate"
					>
						<ShieldCheck />
						<span className="hidden xl:inline">Validate</span>
					</Button>
				</ExecutionHint>
			)}
			{deployFunction && (
				<ExecutionHint reason={blockedReason}>
					<Button
						aria-label="Deploy"
						className="size-7 xl:w-auto xl:px-2"
						disabled={!!blockedReason}
						onClick={deployFunction}
						size="icon"
						title="Deploy"
					>
						<MonitorPlay />
						<span className="hidden xl:inline">Deploy</span>
					</Button>
				</ExecutionHint>
			)}
			{simulateFunction && (
				<ExecutionHint reason={blockedReason}>
					<Button
						aria-label="Simulate"
						className="size-7 xl:w-auto xl:px-2"
						disabled={!!blockedReason}
						onClick={simulateFunction}
						size="icon"
						title="Simulate"
					>
						<Play />
						<span className="hidden xl:inline">Simulate</span>
					</Button>
				</ExecutionHint>
			)}
			{saveFunction && (
				<Button
					aria-label="Save"
					className="size-7 xl:w-auto xl:px-2"
					onClick={saveFunction}
					size="icon"
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
						className="size-7 data-[state=open]:bg-accent"
						size="icon"
						title="More actions"
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

function ExecutionHint({
	reason,
	children,
}: {
	reason: string;
	children: React.ReactNode;
}) {
	if (!reason) return children;
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex" title={reason}>
						{children}
					</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-xs">{reason}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
