"use client";

import { client } from "@/api/client";
import {
	CodeGenerationPanel,
	DiagramPromptForm,
	StructureEditor,
} from "@/components/custom/generate";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import { useGenerateDiagram } from "@/hooks/useGenerateDiagram";
import { useToast } from "@/hooks/use-toast";
import { createAtomicModelRequests, createCoupledModelRequests } from "@/lib/llmToReactFlow";
import type { GeneratedDiagram, GeneratorPhase } from "@/types";
import {
	ArrowLeft,
	CheckCircle2,
	Code2,
	FileText,
	Loader2,
	Save,
	Sparkles,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

const phaseSteps = [
	{ id: "prompt", label: "Description", icon: FileText },
	{ id: "structure", label: "Structure", icon: Sparkles },
	{ id: "code", label: "Code", icon: Code2 },
	{ id: "complete", label: "Complete", icon: CheckCircle2 },
] as const;

export function GeneratorFlow() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { generateDiagram, isLoading: isGeneratingDiagram } =
		useGenerateDiagram();

	const [phase, setPhase] = useState<GeneratorPhase>("prompt");
	const [diagramName, setDiagramName] = useState("");
	const [userPrompt, setUserPrompt] = useState("");
	const [diagram, setDiagram] = useState<GeneratedDiagram | null>(null);
	const [currentModelIndex, setCurrentModelIndex] = useState(0);
	const [isSaving, setIsSaving] = useState(false);

	// Phase 1: Génération de la structure du diagram
	const handleGenerateDiagram = async (name: string, prompt: string) => {
		setDiagramName(name);
		setUserPrompt(prompt);

		const result = await generateDiagram({
			diagramName: name,
			userPrompt: prompt,
		});

		if (result) {
			setDiagram(result);
			setPhase("structure");
			toast({
				title: "Structure generated",
				description: `${result.models.length} model(s) created`,
			});
		} else {
			toast({
				title: "Generation error",
				description: "Unable to generate the diagram. Please try again.",
				variant: "destructive",
			});
		}
	};

	// Phase 2: Validation de la structure
	const handleValidateStructure = () => {
		if (diagram) {
			setPhase("code");
			setCurrentModelIndex(0);
		}
	};

	const handleRegenerateStructure = async () => {
		const result = await generateDiagram({
			diagramName,
			userPrompt,
		});

		if (result) {
			setDiagram(result);
			toast({
				title: "Structure regenerated",
				description: `${result.models.length} model(s) created`,
			});
		}
	};

	const handleDiagramChange = (updatedDiagram: GeneratedDiagram) => {
		setDiagram(updatedDiagram);
	};

	// Phase 3: Code generation and validation (only for atomic models)
	const handleCodeGenerated = useCallback(
		(modelId: string, code: string) => {
			if (!diagram) return;

			const updatedModels = diagram.models.map((m) =>
				m.id === modelId ? { ...m, code, codeGenerated: true } : m,
			);

			setDiagram({
				...diagram,
				models: updatedModels,
			});
		},
		[diagram],
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
		[diagram],
	);

	const handleModelValidated = useCallback(() => {
		if (!diagram) return;

		const atomicCount = diagram.models.filter((m) => m.type === "atomic").length;
		const nextIndex = currentModelIndex + 1;
		if (nextIndex >= atomicCount) {
			setPhase("complete");
		} else {
			setCurrentModelIndex(nextIndex);
		}
	}, [diagram, currentModelIndex]);

	// Phase 4: Save to library
	const handleSaveToLibrary = async () => {
		if (!diagram) return;

		setIsSaving(true);

		try {
			// Create a new library for generated models
			const libraryName = `gen_${diagram.name.replace(/\s+/g, "_")}`;

			const libraryResponse = await client.POST("/library", {
				body: {
					title: libraryName,
					description: `Auto-generated models for "${diagram.name}"`,
				},
			});

			if (!libraryResponse.data?.id) {
				throw new Error("Unable to create library");
			}

			const libraryId = libraryResponse.data.id;

			// Step 1: Create atomic models first (they have code)
			// We need to track the mapping from model name to DB-generated ID
			const { requests: atomicRequests } = createAtomicModelRequests(diagram, libraryId);
			const dbIdMap = new Map<string, string>(); // Map from model name to DB ID

			for (const modelRequest of atomicRequests) {
				const modelResponse = await client.POST("/model", {
					body: modelRequest,
				});

				if (modelResponse.data?.id) {
					// Store the DB-generated ID mapped to the model name
					dbIdMap.set(modelRequest.name, modelResponse.data.id);
				} else {
					console.error(`Error creating atomic model ${modelRequest.name}`);
				}
			}

			// Step 2: Create coupled models with references to atomic models (using DB IDs)
			const coupledRequests = createCoupledModelRequests(diagram, libraryId, dbIdMap);

			for (const modelRequest of coupledRequests) {
				const modelResponse = await client.POST("/model", {
					body: modelRequest,
				});

				if (!modelResponse.data) {
					console.error(`Error creating coupled model ${modelRequest.name}`);
				}
			}

			const totalModels = atomicRequests.length + coupledRequests.length;

			toast({
				title: "Models saved",
				description: `${totalModels} model(s) added to library "${libraryName}" (${atomicRequests.length} atomic, ${coupledRequests.length} coupled)`,
			});

			// Redirect to the created library
			navigate(`/library/${libraryId}`);
		} catch (error) {
			toast({
				title: "Save error",
				description:
					error instanceof Error ? error.message : "An error occurred",
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
					{ label: "Libraries", href: "/library" },
					{ label: "Model Generator" },
				]}
				showModeToggle
			/>

			{/* Indicateur de progression */}
			<div className="border-b bg-muted/30">
				<div className="max-w-4xl mx-auto px-4 py-3">
					<div className="flex items-center justify-between">
						{phaseSteps.map((step, index) => {
							const Icon = step.icon;
							const isActive = index === currentPhaseIndex;
							const isCompleted = index < currentPhaseIndex;

							return (
								<div key={step.id} className="flex items-center">
									<div
										className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
											isActive
												? "bg-primary text-primary-foreground"
												: isCompleted
													? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
													: "bg-muted text-muted-foreground"
										}`}
									>
										<Icon className="w-4 h-4" />
										<span className="text-sm font-medium hidden sm:inline">
											{step.label}
										</span>
									</div>
									{index < phaseSteps.length - 1 && (
										<div
											className={`w-8 sm:w-16 h-0.5 mx-2 ${
												index < currentPhaseIndex
													? "bg-green-500"
													: "bg-muted"
											}`}
										/>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Bouton retour */}
			{phase !== "prompt" && (
				<div className="border-b px-4 py-2">
					<Button variant="ghost" size="sm" onClick={handleGoBack}>
						<ArrowLeft className="w-4 h-4 mr-2" />
						Back
					</Button>
				</div>
			)}

			{/* Contenu principal selon la phase */}
			<div className="flex-1 overflow-hidden">
				{phase === "prompt" && (
					<DiagramPromptForm
						onGenerate={handleGenerateDiagram}
						isLoading={isGeneratingDiagram}
						initialName={diagramName}
						initialPrompt={userPrompt}
					/>
				)}

				{phase === "structure" && diagram && (
					<StructureEditor
						diagram={diagram}
						onDiagramChange={handleDiagramChange}
						onValidate={handleValidateStructure}
						onRegenerate={handleRegenerateStructure}
					/>
				)}

				{phase === "code" && diagram && (
					<CodeGenerationPanel
						diagram={diagram}
						currentModelIndex={currentModelIndex}
						onCodeGenerated={handleCodeGenerated}
						onModelValidated={handleModelValidated}
						onCodeChange={handleCodeChange}
					/>
				)}

				{phase === "complete" && diagram && (
					<div className="h-full flex flex-col items-center justify-center p-8">
						<CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
						<h1 className="text-3xl font-bold mb-2">Generation Complete!</h1>
						<p className="text-muted-foreground text-center max-w-md mb-8">
							All models for "{diagram.name}" have been generated
							successfully. You can now save them to your library.
						</p>

						<div className="flex gap-4">
							<Button
								variant="outline"
								onClick={() => setPhase("code")}
							>
								<Code2 className="w-4 h-4 mr-2" />
								Review Code
							</Button>
							<Button onClick={handleSaveToLibrary} disabled={isSaving}>
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

						<div className="mt-8 p-4 bg-muted rounded-lg max-w-md">
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
