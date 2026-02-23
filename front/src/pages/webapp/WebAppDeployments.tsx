import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useGetWebAppDeployments } from "@/queries/webapp/useGetWebAppDeployments";
import { Globe, Lock, Rocket, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function WebAppDeployments() {
	const navigate = useNavigate();
	const { data: deployments, isLoading } = useGetWebAppDeployments();

	return (
		<div className="flex h-screen w-full flex-col">
			<NavHeader
				breadcrumbs={[{ label: "Home", href: "/" }, { label: "WebApps" }]}
				showNavActions={false}
				showModeToggle
			/>

			<div className="flex-1 overflow-auto p-6">
				<div className="mx-auto w-full max-w-6xl space-y-6">
					<div className="flex items-center justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold">WebApp Deployments</h1>
							<p className="text-sm text-muted-foreground">
								Deployable runtime interfaces generated from validated DEVS
								models.
							</p>
						</div>
						<Button
							variant="outline"
							onClick={() => navigate("/")}
							className="shrink-0"
						>
							<Sparkles className="mr-2 h-4 w-4" />
							From a model editor
						</Button>
					</div>

					{isLoading ? (
						<div className="text-sm text-muted-foreground">Loading...</div>
					) : null}

					{!isLoading && (!deployments || deployments.length === 0) ? (
						<Card>
							<CardHeader>
								<CardTitle>No WebApp deployment yet</CardTitle>
								<CardDescription>
									Open a model and use the WebApp action to generate and deploy
									your first runtime UI.
								</CardDescription>
							</CardHeader>
						</Card>
					) : null}

					{deployments && deployments.length > 0 ? (
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
							{deployments.map((deployment) => (
								<Card key={deployment.id}>
									<CardHeader>
										<div className="flex items-start justify-between gap-2">
											<div>
												<CardTitle className="text-lg">
													{deployment.name || "Unnamed deployment"}
												</CardTitle>
												<CardDescription className="font-mono text-xs break-all">
													{deployment.slug}
												</CardDescription>
											</div>
											<Badge
												variant="outline"
												className="flex items-center gap-1"
											>
												{deployment.isPublic ? (
													<>
														<Globe className="h-3.5 w-3.5" />
														Public
													</>
												) : (
													<>
														<Lock className="h-3.5 w-3.5" />
														Private
													</>
												)}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-2 text-sm">
										<div className="text-muted-foreground">
											{deployment.description || "No description provided."}
										</div>
										<div className="grid grid-cols-2 gap-2 text-xs">
											<div className="rounded border p-2">
												<div className="text-muted-foreground">Parameters</div>
												<div className="font-semibold">
													{deployment.contract?.parameterBindings?.length ?? 0}
												</div>
											</div>
											<div className="rounded border p-2">
												<div className="text-muted-foreground">I/O Ports</div>
												<div className="font-semibold">
													{(deployment.contract?.inputPortBindings?.length ?? 0) +
														(deployment.contract?.outputPortBindings?.length ?? 0)}
												</div>
											</div>
										</div>
									</CardContent>
									<CardFooter className="flex items-center justify-end gap-2">
										<Button onClick={() => navigate(`/webapps/${deployment.id}`)}>
											<Rocket className="mr-2 h-4 w-4" />
											Open runtime
										</Button>
									</CardFooter>
								</Card>
							))}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
