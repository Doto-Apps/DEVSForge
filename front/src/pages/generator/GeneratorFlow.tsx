import { useWorkbench, useWorkbenchState } from "@/providers/WorkbenchProvider";
import { StructureConversation } from "@/components/custom/generate/StructureConversation";
("use client");

import {
	ArrowLeft,
	CheckCircle2,
	Code2,
	FileText,
	Loader2,
	Save,
	Network,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "@/api/client";
import {
	CodeGenerationPanel,
	DiagramPromptForm,
	StructureEditor,
} from "@/components/custom/generate";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGenerateDiagram } from "@/hooks/useGenerateDiagram";
import {
	createAtomicModelRequests,
	createCoupledModelRequest,
	validateGeneratedStructure,
} from "@/lib/llmToReactFlow";
import type {
	GeneratedDiagram,
	GeneratedModelData,
	GeneratedModelLanguage,
	GeneratorPhase,
} from "@/types";

const phaseSteps = [
	{ icon: FileText, id: "prompt", label: "Description" },
	{ icon: Network, id: "structure", label: "Structure" },
	{ icon: Code2, id: "code", label: "Code" },
	{ icon: CheckCircle2, id: "complete", label: "Complete" },
] as const;

const extractApiErrorMessage = (apiError: unknown): string | null => {
	if (!apiError || typeof apiError !== "object") return null;
	const payload = apiError as Record<string, unknown>;

	for (const key of ["error", "message", "detail"] as const) {
		const value = payload[key];
		if (typeof value === "string" && value.trim()) return value;
	}

	return null;
};

const resolveCreatedModelDatabaseID = (
	diagram: GeneratedDiagram,
	createdModelIDByName: Map<string, string>,
	logicalModelID: string,
): string | undefined => {
	const trimmedLogicalID = logicalModelID.trim();
	const directID = createdModelIDByName.get(trimmedLogicalID);
	if (directID) return directID;

	const generatedModel = diagram.models.find(
		(model) => model.id === trimmedLogicalID || model.name === trimmedLogicalID,
	);
	if (!generatedModel) return undefined;

	return (
		createdModelIDByName.get(generatedModel.id) ??
		createdModelIDByName.get(generatedModel.name)
	);
};

export function GeneratorFlow() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const {
		generateDiagram,
		error: diagramError,
		isLoading: isGeneratingDiagram,
	} = useGenerateDiagram();

	const [phase, setPhase] = useWorkbenchState<GeneratorPhase>(
		"generator:phase",
		"prompt",
	);
	const [diagramName, setDiagramName] = useWorkbenchState(
		"generator:diagramName",
		"",
	);
	const [userPrompt, setUserPrompt] = useWorkbenchState(
		"generator:userPrompt",
		"",
	);
	const [diagram, setDiagram] = useWorkbenchState<GeneratedDiagram | null>(
		"generator:diagram",
		null,
	);
	const [currentModelIndex, setCurrentModelIndex] = useWorkbenchState(
		"generator:currentModelIndex",
		0,
	);
	const [isSaving, setIsSaving] = useState(false);
	const workbench = useWorkbench();
	const generationRequest = useRef(0);
	useEffect(
		() => () => {
			generationRequest.current += 1;
		},
		[],
	);

	// The description form starts a new system. Refinements belong to the conversation.
	const handleGenerateDiagram = async (name: string, prompt: string) => {
		const request = ++generationRequest.current;
		const result = await generateDiagram({
			diagramName: name,
			userPrompt: prompt,
		});
		if (request !== generationRequest.current) return;

		if (result) {
			setDiagramName(name);
			setUserPrompt(prompt);
			setDiagram(result);
			setCurrentModelIndex(0);
			workbench.setDraft("generator:history", []);
			workbench.setDraft("generator:proposal", null);
			workbench.setDraft("generator:base", "");
			workbench.setDraft("generator:input", "");
			setPhase("structure");
			toast({
				description: `${result.models.length} model(s) created`,
				title: "Structure generated",
			});
		} else {
			toast({
				description: "Unable to generate the diagram. Please try again.",
				title: "Generation error",
				variant: "destructive",
			});
		}
	};

	// Phase 2: Validation de la structure
	const handleValidateStructure = () => {
		if (diagram && validateGeneratedStructure(diagram).length === 0) {
			setPhase("code");
			setCurrentModelIndex(0);
		}
	};

	const handleRegenerateStructure = () =>
		toast({
			title: "Refine the structure",
			description: "Use Discuss structure to request and review a correction.",
		});

	const handleDiagramChange = (updatedDiagram: GeneratedDiagram) => {
		setDiagram(updatedDiagram);
	};

	// Phase 3: Code generation and validation (only for atomic models)
	const handleCodeGenerated = useCallback(
		(
			modelId: string,
			code: string,
			language?: GeneratedModelLanguage,
			integrationId?: string,
			integrationVersion?: string,
		) => {
			if (!diagram) return;

			const updatedModels = diagram.models.map((m) =>
				m.id === modelId
					? {
							...m,
							code,
							codeGenerated: true,
							needsRevalidation: false,
							language,
							integrationId,
							integrationVersion,
						}
					: m,
			);

			setDiagram({
				...diagram,
				models: updatedModels,
			});
		},
		[diagram, setDiagram],
	);

	const handleCodeChange = useCallback(
		(modelId: string, code: string) => {
			if (!diagram) return;

			const updatedModels = diagram.models.map((m) =>
				m.id === modelId ? { ...m, code } : m,
			);

			setDiagram({
				...diagram,
				models: updatedModels,
			});
		},
		[diagram, setDiagram],
	);

	const handleModelValidated = useCallback(() => {
		if (!diagram) return;

		const atomicCount = diagram.models.filter(
			(m) => m.type === "atomic",
		).length;
		const nextIndex = currentModelIndex + 1;
		if (nextIndex >= atomicCount) {
			setPhase("complete");
		} else {
			setCurrentModelIndex(nextIndex);
		}
	}, [diagram, currentModelIndex, setPhase, setCurrentModelIndex]);

	// Phase 4: Save to library
	const handleSaveToLibrary = async () => {
		if (!diagram) return;
		const issues = validateGeneratedStructure(diagram);
		if (diagram.models.some((m) => m.needsRevalidation))
			issues.push(
				"Review the code of models whose interface changed before saving.",
			);
		if (issues.length) {
			toast({
				title: "Invalid structure",
				description: issues.join("; "),
				variant: "destructive",
			});
			return;
		}
		setIsSaving(true);

		try {
			// Create a new library for generated models
			const libraryName = `gen_${diagram.name.replace(/\s+/g, "_")}`;

			const libraryResponse = await client.POST("/library", {
				body: {
					description: `Auto-generated models for "${diagram.name}"`,
					title: libraryName,
				},
			});

			if (libraryResponse.error || !libraryResponse.data?.id) {
				throw new Error(
					extractApiErrorMessage(libraryResponse.error) ??
						"Unable to create library",
				);
			}

			const libraryId = libraryResponse.data.id;

			// Step 1: Create atomic models first (they have code)
			// We need to track the mapping from model name to DB-generated ID
			const { requests: atomicRequests } = createAtomicModelRequests(
				diagram,
				libraryId,
			);
			const dbIdMap = new Map<string, string>(); // Map from model name to DB ID

			for (const modelRequest of atomicRequests) {
				const modelResponse = await client.POST("/model", {
					body: modelRequest,
				});

				if (modelResponse.error || !modelResponse.data?.id) {
					throw new Error(
						extractApiErrorMessage(modelResponse.error) ??
							`Error creating atomic model ${modelRequest.name}`,
					);
				}

				// Store the DB-generated ID mapped to the generated model name.
				dbIdMap.set(modelRequest.name, modelResponse.data.id);
				const generatedModel = diagram.models.find(
					(model) =>
						model.type === "atomic" && model.name === modelRequest.name,
				);
				if (generatedModel) {
					dbIdMap.set(generatedModel.id, modelResponse.data.id);
				}
			}

			// Step 2: Create coupled models once every component already has a DB ID.
			const coupledModels = diagram.models.filter(
				(model): model is GeneratedModelData & { type: "coupled" } =>
					model.type === "coupled",
			);
			const remainingCoupledModels = new Map(
				coupledModels.map((model) => [model.id, model]),
			);

			while (remainingCoupledModels.size > 0) {
				let progressed = false;

				for (const [modelId, model] of Array.from(remainingCoupledModels)) {
					const missingComponents = (model.components ?? []).filter(
						(componentID) =>
							!resolveCreatedModelDatabaseID(diagram, dbIdMap, componentID),
					);
					if (missingComponents.length > 0) {
						continue;
					}

					const modelRequest = createCoupledModelRequest(
						diagram,
						libraryId,
						dbIdMap,
						model,
					);
					const modelResponse = await client.POST("/model", {
						body: modelRequest,
					});

					if (modelResponse.error || !modelResponse.data?.id) {
						throw new Error(
							extractApiErrorMessage(modelResponse.error) ??
								`Error creating coupled model ${modelRequest.name}`,
						);
					}

					dbIdMap.set(model.id, modelResponse.data.id);
					dbIdMap.set(model.name, modelResponse.data.id);
					remainingCoupledModels.delete(modelId);
					progressed = true;
				}

				if (!progressed) {
					const unresolved = Array.from(remainingCoupledModels.values())
						.map(
							(model) =>
								`${model.name}: ${(model.components ?? []).join(", ")}`,
						)
						.join("; ");
					throw new Error(
						`Unable to resolve coupled model components: ${unresolved}`,
					);
				}
			}

			const totalModels = atomicRequests.length + coupledModels.length;

			toast({
				description: `${totalModels} model(s) added to library "${libraryName}" (${atomicRequests.length} atomic, ${coupledModels.length} coupled)`,
				title: "Models saved",
			});

			// Redirect to the created library
			navigate(`/library/${libraryId}`);
		} catch (error) {
			toast({
				description:
					error instanceof Error ? error.message : "An error occurred",
				title: "Save error",
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	// Navigation entre phases
	const handleGoBack = () => {
		switch (phase) {
			case "structure":
				setPhase("prompt");
				break;
			case "code":
				setPhase("structure");
				break;
			case "complete":
				setPhase("code");
				break;
		}
	};

	const currentPhaseIndex = phaseSteps.findIndex((s) => s.id === phase);

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					{ label: "Model Generator" },
				]}
				showModeToggle
				showNavActions={false}
			/>

			<div className="flex shrink-0 items-center gap-4 overflow-x-auto border-b px-4 py-3 lg:px-6">
				{phase !== "prompt" && (
					<Button
						onClick={handleGoBack}
						size="sm"
						variant="ghost"
						className="h-7 shrink-0 px-2"
					>
						<ArrowLeft className="size-3.5" />
						Back
					</Button>
				)}
				<ol
					aria-label="Generation steps"
					className="flex items-center gap-5 text-xs sm:gap-8"
				>
					{phaseSteps.map((step, index) => (
						<li
							key={step.id}
							aria-current={index === currentPhaseIndex ? "step" : undefined}
							className={`flex shrink-0 items-center gap-2 ${index === currentPhaseIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}
						>
							<span className="font-mono text-[10px]">
								{index < currentPhaseIndex ? (
									<CheckCircle2 size={13} />
								) : (
									String(index + 1).padStart(2, "0")
								)}
							</span>
							{step.label}
						</li>
					))}
				</ol>
				{diagram && (
					<Button
						className="ml-auto h-7 shrink-0"
						size="sm"
						variant="outline"
						disabled={isGeneratingDiagram || isSaving}
						onClick={() =>
							setPhase(phase === "prompt" ? "structure" : "prompt")
						}
					>
						{phase === "prompt" ? "Resume structure" : "New generation"}
					</Button>
				)}
			</div>

			{/* Contenu principal selon la phase */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{phase === "prompt" && (
					<div className="flex h-full flex-col">
						{diagram && (
							<p className="shrink-0 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground lg:px-6">
								Creating a structure here starts a new generation. Your previous
								work is kept until it succeeds. Use Resume structure to continue
								it, or Discuss structure to request a correction.
							</p>
						)}
						<div className="min-h-0 flex-1">
							<DiagramPromptForm
								initialName={diagramName}
								initialPrompt={userPrompt}
								isLoading={isGeneratingDiagram}
								onGenerate={handleGenerateDiagram}
							/>
						</div>
					</div>
				)}

				{phase === "structure" && diagram && (
					<StructureEditor
						conversation={
							<StructureConversation
								conversationKey="generator"
								initialPrompt={userPrompt}
								diagram={diagram}
								onChange={setDiagram}
								errorMessage={diagramError}
								onGenerate={(prompt, pastMessages) =>
									generateDiagram({
										diagramName,
										userPrompt: prompt,
										pastMessages,
									})
								}
							/>
						}
						diagram={diagram}
						onDiagramChange={handleDiagramChange}
						onRegenerate={handleRegenerateStructure}
						onValidate={handleValidateStructure}
					/>
				)}

				{phase === "code" && diagram && (
					<CodeGenerationPanel
						currentModelIndex={currentModelIndex}
						diagram={diagram}
						onCodeChange={handleCodeChange}
						onCodeGenerated={handleCodeGenerated}
						onModelValidated={handleModelValidated}
					/>
				)}

				{phase === "complete" && diagram && (
					<div className="h-full overflow-y-auto px-4 py-8 lg:px-6">
						<CheckCircle2 className="mb-4 size-6 text-muted-foreground" />
						<h1 className="mb-2 text-2xl font-semibold tracking-tight">
							Ready to save
						</h1>
						<p className="mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
							Review the models in "{diagram.name}", then save the system to a
							library.
						</p>

						<div className="flex flex-wrap gap-3">
							<Button onClick={() => setPhase("code")} variant="outline">
								<Code2 className="w-4 h-4 mr-2" />
								Review Code
							</Button>
							<Button disabled={isSaving} onClick={handleSaveToLibrary}>
								{isSaving ? (
									<>
										<Loader2 className="w-4 h-4 mr-2 animate-spin" />
										Saving...
									</>
								) : (
									<>
										<Save className="w-4 h-4 mr-2" />
										Save to Library
									</>
								)}
							</Button>
						</div>

						<div className="mt-8 max-w-lg rounded-md bg-muted/30 p-4">
							<h3 className="font-semibold mb-2">Summary</h3>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>
									• {diagram.models.filter((m) => m.type === "atomic").length}{" "}
									atomic model(s)
								</li>
								<li>
									• {diagram.models.filter((m) => m.type === "coupled").length}{" "}
									coupled model(s)
								</li>
								<li>• {diagram.connections.length} connection(s)</li>
							</ul>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
