import {
	Bot,
	CheckCircle2,
	Loader2,
	Rocket,
	Settings2,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { components } from "@/api/v1";
import NavHeader from "@/components/nav/nav-header";
import { Alert } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWebAppGenerator } from "@/hooks/useWebAppGenerator";
import { useGetLibraryById } from "@/queries/library/useGetLibraryById";
import { useGetModelById } from "@/queries/model/useGetModelById";
import { useGetWebAppDeployments } from "@/queries/webapp/useGetWebAppDeployments";

type WebAppContract = components["schemas"]["json.WebAppContract"];
type WebAppUISchema = components["schemas"]["json.WebAppUISchema"];

export function WebAppBuilder() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { libraryId, modelId } = useParams<{
		libraryId: string;
		modelId: string;
	}>();

	const { data: model, isLoading: isLoadingModel } = useGetModelById(
		modelId
			? {
					params: { path: { id: modelId } },
				}
			: null,
	);
	const { data: library, isLoading: isLoadingLibrary } = useGetLibraryById(
		libraryId
			? {
					params: { path: { id: libraryId } },
				}
			: null,
	);
	const {
		data: deployments,
		mutate: mutateDeployments,
		isLoading: isLoadingDeployments,
	} = useGetWebAppDeployments(
		modelId
			? {
					params: { query: { modelId } },
				}
			: null,
	);

	const { generateSkeleton, refineWithAI, createDeployment, error, isLoading } =
		useWebAppGenerator();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [prompt, setPrompt] = useState("");
	const [isPublic, setIsPublic] = useState(false);
	const [contract, setContract] = useState<WebAppContract | null>(null);
	const [uiSchema, setUISchema] = useState<WebAppUISchema | null>(null);

	useEffect(() => {
		if (!model?.name) return;
		setName((current) => (current ? current : `${model.name} WebApp`));
		setDescription((current) =>
			current ? current : `Deployable runtime UI for ${model.name}.`,
		);
	}, [model?.name]);

	const isReadyForSave = Boolean(
		modelId && name.trim() && uiSchema && contract,
	);

	const summary = useMemo(() => {
		return {
			inputs: contract?.inputPortBindings?.length ?? 0,
			outputs: contract?.outputPortBindings?.length ?? 0,
			parameters: contract?.parameterBindings?.length ?? 0,
			sections: uiSchema?.sections?.length ?? 0,
		};
	}, [contract, uiSchema]);

	const handleGenerateSkeleton = async () => {
		if (!modelId) return;
		const result = await generateSkeleton(modelId);
		if (!result?.contract || !result?.uiSchema) {
			toast({
				description: error ?? "Unable to generate a deterministic skeleton.",
				title: "Skeleton generation failed",
				variant: "destructive",
			});
			return;
		}

		setContract(result.contract);
		setUISchema(result.uiSchema);
		toast({
			description: "Contract and base UI schema are ready.",
			title: "Skeleton generated",
		});
	};

	const handleRefineWithAI = async () => {
		if (!modelId) return;
		if (!prompt.trim()) {
			toast({
				description: "Describe the visual/layout refinements you want.",
				title: "Prompt required",
				variant: "destructive",
			});
			return;
		}

		const result = await refineWithAI({
			currentSchema: uiSchema ?? undefined,
			modelId,
			name: name.trim(),
			userPrompt: prompt.trim(),
		});

		if (!result?.contract || !result?.uiSchema) {
			toast({
				description: error ?? "The model did not return a valid schema.",
				title: "AI refinement failed",
				variant: "destructive",
			});
			return;
		}

		setContract(result.contract);
		setUISchema(result.uiSchema);
		toast({
			description: "AI updates were validated against the model contract.",
			title: "Schema refined",
		});
	};

	const handleSaveDeployment = async () => {
		if (!modelId || !uiSchema) return;

		const deployment = await createDeployment({
			description: description.trim(),
			isPublic,
			modelId,
			name: name.trim(),
			prompt: prompt.trim(),
			uiSchema,
		});

		if (!deployment?.id) {
			toast({
				description: error ?? "Unable to persist this deployment.",
				title: "Save failed",
				variant: "destructive",
			});
			return;
		}

		await mutateDeployments();
		toast({
			description: "Your WebApp is now ready to run.",
			title: "Deployment created",
		});
		navigate(`/webapps/${deployment.id}`);
	};

	if (isLoadingModel || isLoadingLibrary) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!model || !modelId || !libraryId) {
		return <div>Model not found</div>;
	}

	return (
		<div className="flex h-screen w-full flex-col">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					{
						href: `/library/${libraryId}`,
						label: library?.title ?? "Library",
					},
					{
						href: `/library/${libraryId}/model/${modelId}`,
						label: model.name ?? "Model",
					},
					{ label: "WebApp deployment" },
				]}
				showModeToggle
				showNavActions={false}
			/>

			<div className="flex-1 overflow-auto p-6">
				<div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Settings2 className="h-4 w-4" />
									WebApp Configuration
								</CardTitle>
								<CardDescription>
									Create a deployable runtime interface from the validated model
									contract.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="webapp-name">Deployment name</Label>
										<Input
											id="webapp-name"
											onChange={(event) => setName(event.target.value)}
											value={name}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="webapp-public">Visibility</Label>
										<div className="flex h-10 items-center justify-between rounded-md border px-3">
											<span className="text-sm text-muted-foreground">
												{isPublic ? "Public deployment" : "Private deployment"}
											</span>
											<Switch
												checked={isPublic}
												onCheckedChange={setIsPublic}
											/>
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="webapp-description">Description</Label>
									<Textarea
										className="min-h-20"
										id="webapp-description"
										onChange={(event) => setDescription(event.target.value)}
										value={description}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="webapp-prompt">AI refinement prompt</Label>
									<Textarea
										className="min-h-28"
										id="webapp-prompt"
										onChange={(event) => setPrompt(event.target.value)}
										placeholder="Example: make a compact operator dashboard with direct language and strong emphasis on output signals."
										value={prompt}
									/>
								</div>
							</CardContent>
							<CardFooter className="flex flex-wrap items-center gap-2">
								<Button
									disabled={isLoading || !modelId}
									onClick={handleGenerateSkeleton}
									variant="outline"
								>
									<Sparkles className="mr-2 h-4 w-4" />
									Generate skeleton
								</Button>
								<Button
									disabled={isLoading || !modelId}
									onClick={handleRefineWithAI}
									variant="outline"
								>
									<Bot className="mr-2 h-4 w-4" />
									Refine with AI
								</Button>
								<Button
									disabled={!isReadyForSave || isLoading}
									onClick={handleSaveDeployment}
								>
									{isLoading ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Saving...
										</>
									) : (
										<>
											<Rocket className="mr-2 h-4 w-4" />
											Save deployment
										</>
									)}
								</Button>
							</CardFooter>
						</Card>

						{error ? <Alert variant="destructive">{error}</Alert> : null}

						<Card>
							<CardHeader>
								<CardTitle>Contract Preview</CardTitle>
								<CardDescription>
									Deterministic interaction contract extracted from model
									artifacts.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
									<div className="rounded border p-3">
										<div className="text-xs text-muted-foreground">
											Parameters
										</div>
										<div className="text-lg font-semibold">
											{summary.parameters}
										</div>
									</div>
									<div className="rounded border p-3">
										<div className="text-xs text-muted-foreground">
											Input ports
										</div>
										<div className="text-lg font-semibold">
											{summary.inputs}
										</div>
									</div>
									<div className="rounded border p-3">
										<div className="text-xs text-muted-foreground">
											Output ports
										</div>
										<div className="text-lg font-semibold">
											{summary.outputs}
										</div>
									</div>
									<div className="rounded border p-3">
										<div className="text-xs text-muted-foreground">
											UI sections
										</div>
										<div className="text-lg font-semibold">
											{summary.sections}
										</div>
									</div>
								</div>

								<div className="grid gap-4 lg:grid-cols-2">
									<div className="rounded border p-3">
										<div className="mb-2 text-sm font-medium">
											Parameter bindings
										</div>
										<div className="max-h-60 space-y-2 overflow-auto pr-1">
											{contract?.parameterBindings?.length ? (
												contract.parameterBindings.map((binding) => (
													<div
														className="rounded border bg-muted/20 p-2 text-xs"
														key={binding.bindingKey}
													>
														<div className="font-semibold">
															{binding.modelName} / {binding.instanceModelId}
														</div>
														<div className="font-mono">{binding.name}</div>
														<div className="text-muted-foreground">
															{binding.type}
														</div>
													</div>
												))
											) : (
												<div className="text-xs text-muted-foreground">
													No parameter binding.
												</div>
											)}
										</div>
									</div>

									<div className="rounded border p-3">
										<div className="mb-2 text-sm font-medium">
											Port bindings
										</div>
										<div className="space-y-2">
											<div>
												<div className="mb-1 text-xs text-muted-foreground">
													Inputs
												</div>
												<div className="flex flex-wrap gap-1">
													{contract?.inputPortBindings?.map((binding) => (
														<Badge key={binding.bindingKey} variant="outline">
															{binding.name}
														</Badge>
													))}
												</div>
											</div>
											<div>
												<div className="mb-1 text-xs text-muted-foreground">
													Outputs
												</div>
												<div className="flex flex-wrap gap-1">
													{contract?.outputPortBindings?.map((binding) => (
														<Badge key={binding.bindingKey} variant="outline">
															{binding.name}
														</Badge>
													))}
												</div>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>UI Schema Sections</CardTitle>
								<CardDescription>
									Preview of the generated schema used at runtime.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								{uiSchema?.sections?.length ? (
									uiSchema.sections.map((section) => (
										<div
											className="rounded border bg-muted/20 p-3 text-sm"
											key={section.id}
										>
											<div className="mb-1 flex items-center justify-between gap-2">
												<div className="font-medium">
													{section.title || section.id}
												</div>
												<Badge variant="outline">{section.kind}</Badge>
											</div>
											<div className="text-xs text-muted-foreground">
												{section.description || "No description"}
											</div>
											<div className="mt-2 text-xs">
												{(section.parameterBindingKeys?.length ?? 0) +
													(section.portBindingKeys?.length ?? 0)}{" "}
												contract bindings
											</div>
										</div>
									))
								) : (
									<div className="text-sm text-muted-foreground">
										Generate a skeleton to preview sections.
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Existing deployments for this model</CardTitle>
								<CardDescription>
									Reuse or inspect previous runtime versions.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								{isLoadingDeployments ? (
									<div className="text-sm text-muted-foreground">
										Loading...
									</div>
								) : null}
								{!isLoadingDeployments &&
								(!deployments || deployments.length === 0) ? (
									<div className="text-sm text-muted-foreground">
										No deployment yet for this model.
									</div>
								) : null}
								{deployments?.map((deployment) => (
									<div
										className="flex items-center justify-between gap-3 rounded border p-2"
										key={deployment.id}
									>
										<div className="min-w-0">
											<div className="truncate text-sm font-medium">
												{deployment.name}
											</div>
											<div className="truncate text-xs text-muted-foreground font-mono">
												{deployment.slug}
											</div>
										</div>
										<Button
											onClick={() => navigate(`/webapps/${deployment.id}`)}
											size="sm"
											variant="outline"
										>
											<CheckCircle2 className="mr-2 h-4 w-4" />
											Open
										</Button>
									</div>
								))}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
