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
	Star,
	Trash,
	Trash2,
} from "lucide-react";
import * as React from "react";

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
				label: "Customize Page",
			},
			{
				icon: FileText,
				label: "Turn into wiki",
			},
		],
	},
	{
		id: "first",
		menu: [
			{
				icon: Link,
				label: "Copy Link",
			},
			{
				icon: Copy,
				label: "Duplicate",
			},
			{
				icon: CornerUpRight,
				label: "Move to",
			},
			{
				icon: Trash2,
				label: "Move to Trash",
			},
		],
	},
	{
		id: "second",
		menu: [
			{
				icon: CornerUpLeft,
				label: "Undo",
			},
			{
				icon: LineChart,
				label: "View analytics",
			},
			{
				icon: GalleryVerticalEnd,
				label: "Version History",
			},
			{
				icon: Trash,
				label: "Show delete pages",
			},
			{
				icon: Bell,
				label: "Notifications",
			},
		],
	},
	{
		id: "third",
		menu: [
			{
				icon: ArrowUp,
				label: "Import",
			},
			{
				icon: ArrowDown,
				label: "Export",
			},
		],
	},
];

type NavActionsProps = {
	saveFunction?: () => Promise<void>;
	simulateFunction?: () => Promise<void>;
	validateFunction?: () => Promise<void>;
	deployFunction?: () => Promise<void>;
};

export function NavActions({
	saveFunction,
	simulateFunction,
	validateFunction,
	deployFunction,
}: NavActionsProps) {
	const [isOpen, setIsOpen] = React.useState(false);

	return (
		<div className="flex items-center gap-2 text-sm">
			{validateFunction && (
				<Button className="h-7 w-7" onClick={validateFunction} size="icon">
					<ShieldCheck />
				</Button>
			)}
			{deployFunction && (
				<Button className="h-7 w-7" onClick={deployFunction} size="icon">
					<MonitorPlay />
				</Button>
			)}
			{simulateFunction && (
				<Button className="h-7 w-7" onClick={simulateFunction} size="icon">
					<Play />
				</Button>
			)}
			{saveFunction && (
				<Button className="h-7 w-7" onClick={saveFunction} size="icon">
					<Save />
				</Button>
			)}

			<div className="hidden font-medium text-muted-foreground md:inline-block">
				Edit Oct 08
			</div>
			<Button className="h-7 w-7" size="icon" variant="ghost">
				<Star />
			</Button>
			<Popover onOpenChange={setIsOpen} open={isOpen}>
				<PopoverTrigger asChild>
					<Button
						className="h-7 w-7 data-[state=open]:bg-accent"
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
						</SidebarContent>
					</Sidebar>
				</PopoverContent>
			</Popover>
		</div>
	);
}
