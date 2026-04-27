import { ChevronRight, PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { librairiesToFront } from "@/lib/librairiesToFront";
import { cn } from "@/lib/utils";
import { useGetLibraries } from "@/queries/library/useGetLibraries";
import { useGetModels } from "@/queries/model/useGetModels";

export function LibrariesHome() {
	const { libraryId } = useParams<{ libraryId: string }>();
	const librariesQuery = useGetLibraries();
	const modelsQuery = useGetModels();

	const libraries = librariesQuery.data ?? [];
	const models = modelsQuery.data ?? [];
	const navLibraries = librairiesToFront(libraries, models);

	const isLoading = librariesQuery.isLoading || modelsQuery.isLoading;

	return (
		<div className="flex h-screen w-full flex-col">
			<NavHeader
				breadcrumbs={[{ label: "Libraries" }]}
				showModeToggle
				showNavActions={false}
			/>
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl space-y-4 p-4">
					<div className="flex items-center justify-between gap-2">
						<p className="text-sm text-muted-foreground">
							Browse your libraries and open a model in one click.
						</p>
						<Button asChild size="sm">
							<Link to="/library/new">
								<PlusIcon />
								New Library
							</Link>
						</Button>
					</div>

					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-36 w-full" />
							<Skeleton className="h-36 w-full" />
							<Skeleton className="h-36 w-full" />
						</div>
					) : libraries.length === 0 ? (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">No library yet</CardTitle>
								<CardDescription>
									Create your first library to start adding models.
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-0">
								<Button asChild size="sm">
									<Link to="/library/new">
										<PlusIcon />
										Create Library
									</Link>
								</Button>
							</CardContent>
						</Card>
					) : (
						navLibraries.map((library) => {
							const libraryModels = library.items ?? [];
							const isSelected = !!libraryId && library.id === libraryId;

							return (
								<Card
									className={cn(isSelected && "border-primary")}
									key={library.id ?? library.title}
								>
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<CardTitle className="truncate text-base">
													{library.title}
												</CardTitle>
												<CardDescription>
													{libraryModels.length} model
													{libraryModels.length > 1 ? "s" : ""}
												</CardDescription>
											</div>
											{library.id ? (
												<Button asChild size="sm" variant="outline">
													<Link to={`/library/${library.id}/model/new`}>
														New model
													</Link>
												</Button>
											) : null}
										</div>
									</CardHeader>
									<CardContent className="pt-0">
										{libraryModels.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												No model in this library.
											</p>
										) : (
											<div className="divide-y rounded-md border">
												{libraryModels.map((model) => {
													const canOpen = !!library.id && !!model.id;
													const ModelIcon = model.icon;

													return canOpen ? (
														<Link
															className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
															key={model.id}
															to={`/library/${library.id}/model/${model.id}`}
														>
															<div className="flex min-w-0 items-center gap-2">
																{ModelIcon ? (
																	<ModelIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
																) : null}
																<span className="truncate">{model.title}</span>
															</div>
															<div className="flex items-center gap-2">
																<ChevronRight className="h-4 w-4 text-muted-foreground" />
															</div>
														</Link>
													) : (
														<div
															className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
															key={`${library.id ?? "library"}-${model.id ?? model.title}`}
														>
															<div className="flex min-w-0 items-center gap-2">
																{ModelIcon ? (
																	<ModelIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
																) : null}
																<span className="truncate">{model.title}</span>
															</div>
															<Badge variant="secondary">
																Unavailable link
															</Badge>
														</div>
													);
												})}
											</div>
										)}
									</CardContent>
								</Card>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
