"use client";

import { ChevronRight, PlusIcon } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import { DropdownMenu } from "@/components/ui/dropdown-menu";

import { workspacesToFront } from "@/lib/workspacesToFront";
import { DiagramDeleteDialog } from "@/modals/diagram/DiagramDeleteDialog";
import { WorkspaceDeleteDialog } from "@/modals/workspace/WorkspaceDeleteDialog";
import { useGetDiagrams } from "@/queries/diagram/useGetDiagrams";
import { useGetWorkspaces } from "@/queries/workspace/useGetWorkspaces";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../ui/context-menu";

export function NavWorkspace() {
	const workspaces = useGetWorkspaces();
	const diagrams = useGetDiagrams();

	const navigate = useNavigate();

	const navWorkspaces = workspacesToFront(
		workspaces.data ?? [],
		diagrams.data ?? [],
	);

	return (
		<SidebarGroup>
			<ContextMenu>
				<ContextMenuTrigger>
					<SidebarGroupLabel className="flex justify-between items-center w-full pl-2 pr-1">
						<span>Workspaces</span>

						<Button asChild variant={"ghost"} size={"sm"} className="h-6 w-6">
							<Link to={"/workspace/new"}>
								<PlusIcon />
							</Link>
						</Button>
					</SidebarGroupLabel>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem>
						<Link to={"/workspace/new"}>New workspace</Link>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<SidebarMenu>
				{navWorkspaces.map((item) => (
					<Collapsible
						key={item.title}
						asChild
						defaultOpen={item.isActive}
						className="group/collapsible"
					>
						<SidebarMenuItem>
							<ContextMenu modal={false}>
								<ContextMenuTrigger>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton tooltip={item.title}>
											<span>{item.title}</span>
											<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
								</ContextMenuTrigger>
								<ContextMenuContent>
									<ContextMenuItem>
										<Link to={`/workspace/${item.id}/diagram/new`}>
											New diagram...
										</Link>
									</ContextMenuItem>
									{item.id ? (
										<WorkspaceDeleteDialog
											workspaceId={item.id}
											workspaceName={item.title}
											onSubmitSuccess={async () => {
												await workspaces.mutate();
												navigate("/");
											}}
											disclosure={
												<ContextMenuItem onSelect={(e) => e.preventDefault()}>
													Delete
												</ContextMenuItem>
											}
										/>
									) : null}
									<ContextMenuSeparator />
									<ContextMenuItem>
										<a href={`#share_lib_${item.title}`}>Share</a>
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
							<CollapsibleContent>
								<SidebarMenuSub>
									{item.items?.map((subItem) => (
										<DropdownMenu key={subItem.title}>
											<ContextMenu>
												<ContextMenuTrigger>
													<SidebarMenuSubItem className="relative z-10">
														<SidebarMenuSubButton asChild>
															<a href={subItem.url}>
																{subItem.icon && <subItem.icon />}
																<span>{subItem.title}</span>
															</a>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												</ContextMenuTrigger>
												<ContextMenuContent>
													<ContextMenuItem>
														<a href={`#edit_model_${subItem.title}`}>Edit</a>
													</ContextMenuItem>
													{subItem.id ? (
														<DiagramDeleteDialog
															diagramId={subItem.id}
															diagramName={subItem.title}
															onSubmitSuccess={async () => {
																await diagrams.mutate();
																navigate("/");
															}}
															disclosure={
																<ContextMenuItem
																	onSelect={(e) => e.preventDefault()}
																>
																	Delete
																</ContextMenuItem>
															}
														/>
													) : null}
												</ContextMenuContent>
											</ContextMenu>
										</DropdownMenu>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</SidebarMenuItem>
					</Collapsible>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
