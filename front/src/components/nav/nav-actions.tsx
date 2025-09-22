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
	MoreHorizontal,
	Play,
	Save,
	Settings2,
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
				label: "Customize Page",
				icon: Settings2,
			},
			{
				label: "Turn into wiki",
				icon: FileText,
			},
		],
	},
	{
		id: "first",
		menu: [
			{
				label: "Copy Link",
				icon: Link,
			},
			{
				label: "Duplicate",
				icon: Copy,
			},
			{
				label: "Move to",
				icon: CornerUpRight,
			},
			{
				label: "Move to Trash",
				icon: Trash2,
			},
		],
	},
	{
		id: "second",
		menu: [
			{
				label: "Undo",
				icon: CornerUpLeft,
			},
			{
				label: "View analytics",
				icon: LineChart,
			},
			{
				label: "Version History",
				icon: GalleryVerticalEnd,
			},
			{
				label: "Show delete pages",
				icon: Trash,
			},
			{
				label: "Notifications",
				icon: Bell,
			},
		],
	},
	{
		id: "third",
		menu: [
			{
				label: "Import",
				icon: ArrowUp,
			},
			{
				label: "Export",
				icon: ArrowDown,
			},
		],
	},
];

type NavActionsProps = {
	saveFunction?: () => Promise<void>;
	simulateFunction?: () => Promise<void>;
};

export function NavActions({
	saveFunction,
	simulateFunction,
}: NavActionsProps) {
	const [isOpen, setIsOpen] = React.useState(false);

	return (
		<div className="flex items-center gap-2 text-sm">
			{saveFunction && (
				<Button size="icon" className="h-7 w-7" onClick={simulateFunction}>
					<Play />
				</Button>
			)}
			{saveFunction && (
				<Button size="icon" className="h-7 w-7" onClick={saveFunction}>
					<Save />
				</Button>
			)}

			<div className="hidden font-medium text-muted-foreground md:inline-block">
				Edit Oct 08
			</div>
			<Button variant="ghost" size="icon" className="h-7 w-7">
				<Star />
			</Button>
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 data-[state=open]:bg-accent"
					>
						<MoreHorizontal />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-56 overflow-hidden rounded-lg p-0"
					align="end"
				>
					<Sidebar collapsible="none" className="bg-transparent">
						<SidebarContent>
							{data.map((group) => (
								<SidebarGroup
									key={group.id}
									className="border-b last:border-none"
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
