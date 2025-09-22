"use client";

import type { LucideIcon } from "lucide-react";

import {
	SidebarGroup,
	SidebarMenu,
	SidebarMenuButton,
} from "@/components/ui/sidebar";

import { Link, useLocation } from "react-router-dom";

export function NavMain({
	mains,
}: {
	mains: {
		name: string;
		url: string;
		icon: LucideIcon;
		isActive?: boolean;
	}[];
}) {
	const location = useLocation();
	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarMenu>
				{mains.map((item) => (
					<SidebarMenuButton
						asChild
						isActive={item.isActive ?? location.pathname === item.url} // Highlight the active link
						key={item.name}
					>
						<Link to={item.url}>
							<item.icon />
							<span>{item.name}</span>
						</Link>
					</SidebarMenuButton>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
