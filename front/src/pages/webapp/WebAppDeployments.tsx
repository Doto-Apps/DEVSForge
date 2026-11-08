import { ArrowRight, Globe, Lock, MonitorPlay, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetWebAppDeployments } from "@/queries/webapp/useGetWebAppDeployments";

export function WebAppDeployments() {
	const {
		data: deployments,
		isLoading,
		error,
		mutate,
	} = useGetWebAppDeployments();
	const [search, setSearch] = useState("");
	const filtered = (deployments ?? []).filter((deployment) =>
		`${deployment.name} ${deployment.slug} ${deployment.contract?.modelName ?? ""}`
			.toLowerCase()
			.includes(search.toLowerCase().trim()),
	);
	return (
		<div className="flex h-screen min-w-0 w-full flex-col">
			<NavHeader
				breadcrumbs={[{ href: "/", label: "Home" }, { label: "WebApps" }]}
				showModeToggle
				showNavActions={false}
			/>
			<div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
				<header className="mb-7 flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							WebApp deployments
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Runnable interfaces for your models. Open one to configure and
							simulate.
						</p>
					</div>
					<Button asChild size="sm" variant="outline">
						<Link to="/library">
							<MonitorPlay />
							Choose a model to deploy
						</Link>
					</Button>
				</header>
				{error ? (
					<div
						className="flex items-center gap-3 py-6 text-sm text-destructive"
						role="alert"
					>
						Deployments could not be loaded.
						<Button onClick={() => void mutate()} size="sm" variant="outline">
							Retry
						</Button>
					</div>
				) : isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : !deployments?.length ? (
					<section className="flex min-h-72 flex-col items-start justify-center rounded-md bg-muted/25 p-6">
						<MonitorPlay className="mb-4 size-7 text-muted-foreground" />
						<h2 className="text-base font-medium">Deploy your first model</h2>
						<p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
							Open a model, choose Deploy in the header, then review its
							parameter and port bindings. Save the interface to add it to this
							list.
						</p>
						<Button asChild className="mt-5" size="sm">
							<Link to="/library">
								Browse models
								<ArrowRight />
							</Link>
						</Button>
						<Link
							className="mt-3 text-xs text-muted-foreground hover:underline"
							to="/how-it-works#webapps"
						>
							How WebApps use your model →
						</Link>
					</section>
				) : (
					<>
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<p className="text-xs text-muted-foreground">
								{filtered.length} of {deployments.length} deployments
							</p>
							<div className="relative w-full sm:w-64">
								<Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
								<Input
									aria-label="Search deployments"
									className="h-9 pl-9"
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search deployments…"
									value={search}
								/>
							</div>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[600px] text-left text-sm">
								<caption className="sr-only">Saved WebApp deployments</caption>
								<thead className="border-b text-xs text-muted-foreground">
									<tr>
										<th className="pb-3 pr-4 font-medium" scope="col">
											Deployment
										</th>
										<th className="pb-3 pr-4 font-medium" scope="col">
											Model
										</th>
										<th className="pb-3 pr-4 font-medium" scope="col">
											Visibility
										</th>
										<th className="pb-3 pr-4 font-medium" scope="col">
											Interface
										</th>
										<th className="pb-3 text-right font-medium" scope="col">
											Runtime
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filtered.map((deployment) => (
										<tr className="hover:bg-muted/25" key={deployment.id}>
											<th
												className="max-w-64 py-4 pr-4 font-normal"
												scope="row"
											>
												<Link
													className="block truncate font-medium hover:underline"
													to={`/webapps/${deployment.id}`}
												>
													{deployment.name || "Unnamed deployment"}
												</Link>
												<span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
													{deployment.slug}
												</span>
											</th>
											<td className="max-w-48 py-4 pr-4">
												<span className="block truncate text-muted-foreground">
													{deployment.contract?.modelName || "—"}
												</span>
											</td>
											<td className="py-4 pr-4">
												<Badge
													className="gap-1.5 font-normal"
													variant="secondary"
												>
													{deployment.isPublic ? (
														<Globe size={12} />
													) : (
														<Lock size={12} />
													)}
													{deployment.isPublic ? "Public" : "Private"}
												</Badge>
											</td>
											<td className="py-4 pr-4 text-xs text-muted-foreground">
												{deployment.contract?.parameterBindings?.length ?? 0}{" "}
												parameters ·{" "}
												{(deployment.contract?.inputPortBindings?.length ?? 0) +
													(deployment.contract?.outputPortBindings?.length ??
														0)}{" "}
												ports
											</td>
											<td className="py-4 text-right">
												<Button asChild size="sm" variant="ghost">
													<Link to={`/webapps/${deployment.id}`}>
														Open
														<ArrowRight size={14} />
													</Link>
												</Button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{!filtered.length && (
							<p
								className="py-10 text-center text-sm text-muted-foreground"
								role="status"
							>
								No deployments match “{search}”.
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
}
