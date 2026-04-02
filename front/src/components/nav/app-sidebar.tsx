"use client";

import { BookOpenText, House, Rocket, Sparkles, Workflow } from "lucide-react";
import type * as React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/AuthProvider";
import { NavLibrary } from "./nav-library";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

// This is sample data.
const data = {
	mains: [
		{
			icon: House,
			name: "Home",
			url: "/",
		},
		{
			icon: BookOpenText,
			name: "Getting Started",
			url: "/getting-started",
		},
		{
			icon: Workflow,
			name: "How It Works",
			url: "/how-it-works",
		},
		{
			icon: Sparkles,
			name: "DEVS Generator",
			url: "/devs-generator",
		},
		{
			icon: Rocket,
			name: "WebApps",
			url: "/webapps",
		},
	],
	user: {
		avatar: "/avatars/shadcn.jpg",
		email: "dominici.antoine.p@gmail.com",
		name: "Antoine",
	},
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { user } = useAuth();
	const sidebarUser = {
		avatar: data.user.avatar,
		email: user?.email ?? data.user.email,
		name:
			user?.username?.trim() || user?.email?.split("@")[0] || data.user.name,
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
