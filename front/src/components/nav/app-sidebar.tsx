"use client";

import { BookOpenText, House, Rocket, Sparkles, Workflow } from "lucide-react";
import type * as React from "react";

import { NavLibrary } from "./nav-library";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/AuthProvider";

// This is sample data.
const data = {
	user: {
		name: "Antoine",
		email: "dominici.antoine.p@gmail.com",
		avatar: "/avatars/shadcn.jpg",
	},
	mains: [
		{
			name: "Home",
			url: "/",
			icon: House,
		},
		{
			name: "Getting Started",
			url: "/getting-started",
			icon: BookOpenText,
		},
		{
			name: "How It Works",
			url: "/how-it-works",
			icon: Workflow,
		},
		{
			name: "DEVS Generator",
			url: "/devs-generator",
			icon: Sparkles,
		},
		{
			name: "WebApps",
			url: "/webapps",
			icon: Rocket,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { user } = useAuth();
	const sidebarUser = {
		name:
			user?.username?.trim() || user?.email?.split("@")[0] || data.user.name,
		email: user?.email ?? data.user.email,
		avatar: data.user.avatar,
	};

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<NavUser user={sidebarUser} />
			</SidebarHeader>
			<SidebarContent>
				<NavMain mains={data.mains} />
				<NavLibrary />
			</SidebarContent>
			<SidebarFooter />
			<SidebarRail />
		</Sidebar>
	);
}
