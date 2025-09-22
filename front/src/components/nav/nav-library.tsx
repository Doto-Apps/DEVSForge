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

import { librairiesToFront } from "@/lib/librairiesToFront";
import { modelToReactflow } from "@/lib/modelToReactflow";
import { LibraryDeleteDialog } from "@/modals/library/LibraryDeleteDialog";
import { ModelDeleteDialog } from "@/modals/model/ModelDeleteDialog";
import { useDnD } from "@/providers/DnDContext";
import { useGetLibraries } from "@/queries/library/useGetLibraries";
import { useGetModelByIdRecursive } from "@/queries/model/useGetModelByIdRecursive";
import { useGetModels } from "@/queries/model/useGetModels";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ModelView } from "../custom/ModelView";
import { Button } from "../ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function NavLibrary() {
	//a voir avec dorian si on met ca dans ce composant ou le composant parent
	const libraries = useGetLibraries();
	const models = useGetModels();
	const [, setDragId] = useDnD();
	const navigate = useNavigate();

	const [hoveredId, setHoveredId] = useState<string | null>(null);

	const { data, isLoading } = useGetModelByIdRecursive(
		hoveredId ? { params: { path: { id: hoveredId ?? "" } } } : null,
	);

	const hoveredModel = hoveredId && data ? modelToReactflow(data) : undefined;

	const navLibraries = librairiesToFront(
		libraries.data ?? [],
		models.data ?? [],
	);

	const onHoverModel = (modelId: string | null) => {
		setHoveredId(modelId);
	};

	const onDragStart = (event: React.DragEvent, nodeId: string) => {
		setDragId(nodeId);
		event.dataTransfer.effectAllowed = "move";
	};

	return (
		<SidebarGroup>
			<ContextMenu>
				<ContextMenuTrigger>
					<SidebarGroupLabel className="flex justify-between items-center w-full pl-2 pr-1">
						<span>Library</span>

						<Button asChild variant={"ghost"} size={"sm"} className="h-6 w-6">
							<Link to={"/library/new"}>
								<PlusIcon />
							</Link>
						</Button>
					</SidebarGroupLabel>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem>
						<Link to={"/library/new"}>New library</Link>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<SidebarMenu>
				{navLibraries.map((item) => (
					<Collapsible
						key={item.title}
						asChild
						defaultOpen={item.isActive}
						className="group/collapsible"
					>
						<SidebarMenuItem>
							<ContextMenu modal={false}>
								<ContextMenuTrigger>
									<CollapsibleTrigger asChild draggable>
										<SidebarMenuButton tooltip={item.title}>
											<span>{item.title}</span>
											<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
								</ContextMenuTrigger>
								<ContextMenuContent>
									<ContextMenuItem>
										<Link to={`/library/${item.id}/model/new`}>
											New model...
										</Link>
									</ContextMenuItem>
									{item.id ? (
										<LibraryDeleteDialog
											libraryId={item.id}
											libraryName={item.title}
											onSubmitSuccess={async () => {
												await libraries.mutate();
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
															<Popover open={hoveredId === subItem.id}>
																<PopoverTrigger asChild>
																	<Link
																		className="flex h-6 text-xs items-center"
																		onMouseEnter={() =>
																			onHoverModel(subItem.id ?? null)
																		}
																		onMouseLeave={() => onHoverModel(null)}
																		draggable
																		onDragStart={(e) =>
																			onDragStart(e, subItem.id ?? "")
																		}
																		to={`/library/${item.id}/model/${subItem.id}`}
																	>
																		{subItem.icon && <subItem.icon />}
																		<span>{subItem.title}</span>
																	</Link>
																</PopoverTrigger>
																<PopoverContent
																	side="right"
																	align="start"
																	className="w-80 h-80 pointer-events-none select-none"
																	onMouseEnter={() =>
																		setHoveredId(subItem.id ?? null)
																	}
																	onMouseLeave={() => setHoveredId(null)}
																>
																	{isLoading && <span>Chargement…</span>}
																	{hoveredModel ? (
																		<ModelView models={hoveredModel} />
																	) : (
																		<span>Aucun aperçu</span>
																	)}
																</PopoverContent>
															</Popover>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												</ContextMenuTrigger>
												<ContextMenuContent>
													<ContextMenuItem>
														<Link
															to={`/library/${item.id}/model/${subItem.id}`}
														>
															Edit
														</Link>
													</ContextMenuItem>
													{subItem.id ? (
														<ModelDeleteDialog
															modelId={subItem.id}
															modelName={subItem.title}
															onSubmitSuccess={async () => {
																await models.mutate();
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
