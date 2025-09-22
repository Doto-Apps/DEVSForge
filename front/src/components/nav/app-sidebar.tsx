"use client";

import {
	BrainCircuit,
	FilePenLine,
	Frame,
	House,
	LayoutDashboard,
	MapIcon,
	PieChart,
	Square,
} from "lucide-react";
import type * as React from "react";

import { NavLibrary } from "./nav-library";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { NavWorkspace } from "./nav-workspace";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";

// This is sample data.
const data = {
	user: {
		name: "Antoine",
		email: "dominici.antoine.p@gmail.com",
		avatar: "/avatars/shadcn.jpg",
	},
	library: [
		{
			title: "Smart-Parking",
			url: "#",
			items: [
				{
					title: "Sensor",
					url: "#",
					icon: Square,
				},
				{
					title: "Collector",
					url: "#",
					icon: Square,
				},
				{
					title: "Acess Conflicts",
					url: "#",
					icon: Square,
				},
				{
					title: "Group Sensor",
					url: "#",
					icon: LayoutDashboard,
				},
			],
		},
		{
			title: "Light-Systems",
			url: "#",
			items: [
				{
					title: "Light Sensor",
					url: "#",
					icon: Square,
				},
				{
					title: "Switch",
					url: "#",
					icon: Square,
				},
				{
					title: "Light",
					url: "#",
					icon: Square,
				},
				{
					title: "Light Group",
					url: "#",
					icon: LayoutDashboard,
				},
				{
					title: "switch Group",
					url: "#",
					icon: LayoutDashboard,
				},
			],
		},
	],
	diagrams: [
		{
			name: "Design Engineering",
			url: "#",
			icon: Frame,
		},
		{
			name: "Sales & Marketing",
			url: "#",
			icon: PieChart,
		},
		{
			name: "Travel",
			url: "#",
			icon: MapIcon,
		},
	],
	mains: [
		{
			name: "Home",
			url: "/",
			icon: House,
		},
		{
			name: "AI Diagram Maker",
			url: "/devs-generator",
			icon: BrainCircuit,
		},
		{
			name: "DEVS Editor",
			url: "/model-code-editor",
			icon: FilePenLine,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<NavUser user={data.user} />
			</SidebarHeader>
			<SidebarContent>
				<NavMain mains={data.mains} />
				<NavLibrary />
				<NavWorkspace />
			</SidebarContent>
			<SidebarFooter />
			<SidebarRail />
		</Sidebar>
	);
}
