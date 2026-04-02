import { Globe, Loader2, Lock, Rocket } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { components } from "@/api/v1";
import {
	SimulationPanel,
	type SimulationParameterTarget,
} from "@/components/custom/SimulationPanel";
import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useGetWebAppDeploymentById } from "@/queries/webapp/useGetWebAppDeploymentById";

type WebAppDeploymentResponse =
	components["schemas"]["response.WebAppDeploymentResponse"];
type WebAppPortBinding = components["schemas"]["json.WebAppPortBinding"];
type WebAppUISectionKind = components["schemas"]["json.WebAppUISectionKind"];
type WebAppUISection = components["schemas"]["json.WebAppUISection"];
type ParameterType = components["schemas"]["json.ParameterType"];

const toParameterType = (value: ParameterType | undefined): ParameterType => {
	if (
		value === "int" ||
		value === "float" ||
		value === "bool" ||
		value === "string" ||
		value === "object"
	) {
		return value;
	}
	return "string";
};

const buildParameterTargets = (
	deployment: WebAppDeploymentResponse | undefined,
): SimulationParameterTarget[] => {
	const bindings = deployment?.contract?.parameterBindings ?? [];
	const grouped = new Map<string, SimulationParameterTarget>();

	for (const binding of bindings) {
		const instanceModelId = binding.instanceModelId ?? "";
		if (!instanceModelId) continue;

		const existing = grouped.get(instanceModelId);
		if (!existing) {
			grouped.set(instanceModelId, {
				instanceModelId,
				modelId: binding.modelId ?? instanceModelId,
				modelName: binding.modelName ?? binding.modelId ?? instanceModelId,
				parameters: [],
			});
		}

		const target = grouped.get(instanceModelId);
		if (!target) continue;

		target.parameters.push({
			description: binding.description ?? "",
			name: binding.name ?? "param",
			type: toParameterType(binding.type as ParameterType | undefined),
			value: binding.defaultValue,
		});
	}

	return Array.from(grouped.values()).sort((a, b) =>
		a.instanceModelId.localeCompare(b.instanceModelId),
	);
};

const buildModelNameByID = (
	deployment: WebAppDeploymentResponse | undefined,
): Record<string, string> => {
	const map: Record<string, string> = {};
	const bindings = deployment?.contract?.parameterBindings ?? [];
	for (const binding of bindings) {
		if (binding.modelId && binding.modelName) {
			map[binding.modelId] = binding.modelName;
		}
	}
	if (deployment?.modelId && deployment?.contract?.modelName) {
		map[deployment.modelId] = deployment.contract.modelName;
	}
	return map;
};

const renderPortBadges = (ports: WebAppPortBinding[] | undefined) => {
	if (!ports || ports.length === 0) {
		return <div className="text-xs text-muted-foreground">None</div>;
	}

	return (
		<div className="flex flex-wrap gap-1">
			{ports.map((port) => (
				<Badge key={port.bindingKey} variant="outline">
					{port.name || port.portId}
				</Badge>
			))}
		</div>
	);
};

const getSectionByKind = (
	sections: WebAppUISection[] | undefined,
	kind: WebAppUISectionKind,
) => sections?.find((section) => section.kind === kind);

export function WebAppDeployment() {
	const { deploymentId } = useParams<{ deploymentId: string }>();
	const { data: deployment, isLoading } = useGetWebAppDeploymentById(
		deploymentId
			? {
					params: {
						path: {
							id: deploymentId,
						},
					},
				}
			: null,
	);

	const parameterTargets = useMemo(
		() => buildParameterTargets(deployment),
		[deployment],
	);
	const modelNameById = useMemo(
		() => buildModelNameByID(deployment),
		[deployment],
	);
	const schemaSections = deployment?.uiSchema?.sections ?? [];
	const effectiveSections = useMemo<WebAppUISection[]>(
		() =>
			schemaSections.length > 0
				? schemaSections
				: [
						{
							description: "",
							id: "parameters",
							kind: "parameters",
							parameterBindingKeys: [],
							portBindingKeys: [],
							title: "Parameters",
						},
						{
							description: "",
							id: "inputs",
							kind: "inputs",
							parameterBindingKeys: [],
							portBindingKeys: [],
							title: "Input Interface",
						},
						{
							description: "",
							id: "outputs",
							kind: "outputs",
							parameterBindingKeys: [],
							portBindingKeys: [],
							title: "Output Interface",
						},
						{
							description: "",
							id: "run",
							kind: "run",
							parameterBindingKeys: [],
							portBindingKeys: [],
							title: "Simulation",
						},
					],
		[schemaSections],
	);
	const parameterSection = useMemo(
		() => getSectionByKind(effectiveSections, "parameters"),
		[effectiveSections],
	);

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!deployment?.modelId) {
		return <div>Deployment not found</div>;
	}

	const renderSection = (section: WebAppUISection): ReactNode => {
		if (section.kind === "parameters") {
			return (
				<Card key={section.id}>
					<CardHeader>
						<CardTitle className="text-base">
							{section.title || "Parameters"}
						</CardTitle>
						{section.description ? (
							<CardDescription>{section.description}</CardDescription>
						) : null}
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{parameterTargets.length === 0 ? (
								<div className="text-xs text-muted-foreground">
									No runtime parameters available.
								</div>
							) : (
								parameterTargets.map((target) => (
									<div
										className="rounded border p-2"
										key={target.instanceModelId}
									>
										<div className="text-sm font-medium">
											{target.modelName}
										</div>
										<div className="text-xs text-muted-foreground font-mono break-all">
											{target.instanceModelId}
										</div>
										<div className="mt-1 flex flex-wrap gap-1">
											{target.parameters.map((parameter) => (
												<Badge
													key={`${target.instanceModelId}-${parameter.name}`}
													variant="outline"
												>
													{parameter.name}
												</Badge>
											))}
										</div>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>
			);
		}

		if (section.kind === "inputs") {
			return (
				<Card key={section.id}>
					<CardHeader>
						<CardTitle className="text-base">
							{section.title || "Input Interface"}
						</CardTitle>
						{section.description ? (
							<CardDescription>{section.description}</CardDescription>
						) : null}
					</CardHeader>
					<CardContent>
						{renderPortBadges(deployment.contract?.inputPortBindings)}
					</CardContent>
				</Card>
			);
		}

		if (section.kind === "outputs") {
			return (
				<Card key={section.id}>
					<CardHeader>
						<CardTitle className="text-base">
							{section.title || "Output Interface"}
						</CardTitle>
						{section.description ? (
							<CardDescription>{section.description}</CardDescription>
						) : null}
					</CardHeader>
					<CardContent>
						{renderPortBadges(deployment.contract?.outputPortBindings)}
					</CardContent>
				</Card>
			);
		}

		if (section.kind === "run" && deployment.modelId) {
			return (
				<SimulationPanel
					key={section.id}
					modelId={deployment.modelId}
					modelName={deployment.name || deployment.contract?.modelName}
					modelNameById={modelNameById}
					panelDescription={
						section.description ||
						"Run the deployed WebApp contract against the simulation backend."
					}
					panelTitle={section.title || "Simulation"}
					parameterSectionDescription={
						parameterSection?.description ||
						"Optional. Overrides are applied only for this simulation run."
					}
					parameterSectionTitle={
						parameterSection?.title || "Runtime Parameter Overrides"
					}
					parameterTargets={parameterTargets}
					runButtonLabel={deployment.uiSchema?.runButtonLabel || "Start"}
					showParameterOverrides={Boolean(parameterSection)}
				/>
			);
		}

		return (
			<Card key={section.id}>
				<CardHeader>
					<CardTitle className="text-base">
						{section.title || section.id}
					</CardTitle>
					{section.description ? (
						<CardDescription>{section.description}</CardDescription>
					) : null}
				</CardHeader>
				<CardContent>
					<div className="text-sm text-muted-foreground">
						Custom section placeholder.
					</div>
				</CardContent>
			</Card>
		);
	};

	return (
		<div className="flex h-screen w-full flex-col">
			<NavHeader
				breadcrumbs={[
					{ href: "/", label: "Home" },
					{ href: "/webapps", label: "WebApps" },
					{ label: deployment.name || "Deployment" },
				]}
				showModeToggle
				showNavActions={false}
			/>

			<div className="flex-1 overflow-auto p-6 space-y-6">
				<div className="mx-auto w-full max-w-7xl space-y-6">
					<Card>
						<CardHeader>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Rocket className="h-4 w-4" />
										{deployment.name || "WebApp Deployment"}
									</CardTitle>
									<CardDescription>
										{deployment.description || "Deployable runtime interface"}
									</CardDescription>
								</div>
								<Badge className="flex items-center gap-1" variant="outline">
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
						<CardContent className="grid gap-4 md:grid-cols-4">
							<div className="rounded border p-3">
								<div className="text-xs text-muted-foreground">Parameters</div>
								<div className="text-lg font-semibold">
									{deployment.contract?.parameterBindings?.length ?? 0}
								</div>
							</div>
							<div className="rounded border p-3">
								<div className="text-xs text-muted-foreground">Input ports</div>
								<div className="text-lg font-semibold">
									{deployment.contract?.inputPortBindings?.length ?? 0}
								</div>
							</div>
							<div className="rounded border p-3">
								<div className="text-xs text-muted-foreground">
									Output ports
								</div>
								<div className="text-lg font-semibold">
									{deployment.contract?.outputPortBindings?.length ?? 0}
								</div>
							</div>
							<div className="rounded border p-3">
								<div className="text-xs text-muted-foreground">UI sections</div>
								<div className="text-lg font-semibold">
									{deployment.uiSchema?.sections?.length ?? 0}
								</div>
							</div>
						</CardContent>
					</Card>

					<div
						className={
							deployment.uiSchema?.layout === "single-column"
								? "grid grid-cols-1 gap-4"
								: "grid grid-cols-1 gap-4 lg:grid-cols-2"
						}
					>
						{effectiveSections.map((section) => (
							<div
								className={section.kind === "run" ? "lg:col-span-2" : ""}
								key={section.id}
							>
								{renderSection(section)}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
