import {
	CheckCircle2,
	GaugeCircle,
	Loader,
	Plus,
	ShieldCheck,
	Shuffle,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "@/api/client";
import type { components } from "@/api/v1";
import {
	CodeGenerationPanel,
	StructureEditor,
} from "@/components/custom/generate";
import NavHeader from "@/components/nav/nav-header";
import { Alert } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGenerateEFStructure } from "@/hooks/useGenerateEFStructure";
import {
	replaceGeneratedMutPlaceholder,
	validateGeneratedMutConnections,
} from "@/lib/llmToReactFlow";
import { useGetLibraryById } from "@/queries/library/useGetLibraryById";
import { useGetExperimentalFramesByModel } from "@/queries/model/useGetExperimentalFramesByModel";
import { useGetModelById } from "@/queries/model/useGetModelById";
import { useGetModels } from "@/queries/model/useGetModels";
import type { GeneratedDiagram } from "@/types";

const DEFAULT_NODE_SIZE = 200;
const EF_CODE_GENERATION_ROLES = [
	"generator",
	"transducer",
	"acceptor",
] as const;
type ValidationAIMode = "structure" | "code";

type FrameModelDetails = {
	id: string;
	name: string;
};

const extractApiErrorMessage = (apiError: unknown): string | null => {
	if (!apiError || typeof apiError !== "object") return null;
	const payload = apiError as Record<string, unknown>;

	const directKeys = ["error", "message", "detail"] as const;
	for (const key of directKeys) {
		const value = payload[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	const dataField = payload.data;
	if (typeof dataField === "string" && dataField.trim().length > 0) {
		return dataField;
	}

	for (const value of Object.values(payload)) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	return null;
};

export function ValidationModel() {
	const { libraryId, modelId } = useParams<{
		libraryId: string;
		modelId: string;
	}>();
	const navigate = useNavigate();
	const { toast } = useToast();
	const [isCreating, setIsCreating] = useState(false);
	const [isSavingAssisted, setIsSavingAssisted] = useState(false);
	const [newFrameName, setNewFrameName] = useState("");
	const [aiRoomName, setAiRoomName] = useState("");
	const [aiPrompt, setAiPrompt] = useState("");
	const [aiMode, setAiMode] = useState<ValidationAIMode>("structure");
	const [currentAICodeModelIndex, setCurrentAICodeModelIndex] = useState(0);
	const [aiDiagram, setAiDiagram] = useState<GeneratedDiagram | null>(null);
	const [frameDetailsById, setFrameDetailsById] = useState<
		Record<string, FrameModelDetails>
	>({});
	const {
		generateEFStructure,
		isLoading: isGeneratingAIStructure,
		error: aiError,
	} = useGenerateEFStructure();

	const { data: targetModel, isLoading: isLoadingTargetModel } =
		useGetModelById(
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
		data: frames,
		isLoading: isLoadingFrames,
		error: framesError,
		mutate,
	} = useGetExperimentalFramesByModel(
		modelId
			? {
					params: { path: { modelId } },
				}
			: null,
	);
	const { mutate: mutateModels } = useGetModels();

	useEffect(() => {
		const fetchFrameModels = async () => {
			if (!frames || frames.length === 0) {
				setFrameDetailsById({});
				return;
			}

			const results = await Promise.all(
				frames.map(async (frame) => {
					if (!frame.frameModelId) return null;
					const res = await client.GET("/model/{id}", {
						params: { path: { id: frame.frameModelId } },
					});
					if (!res.data) return null;
					return { id: res.data.id, name: res.data.name } as FrameModelDetails;
				}),
			);

			const next: Record<string, FrameModelDetails> = {};
			for (const item of results) {
				if (item) next[item.id] = item;
			}
			setFrameDetailsById(next);
		};

		void fetchFrameModels();
	}, [frames]);

	const shouldGenerateCodeForEFModel = useCallback(
		(model: NonNullable<GeneratedDiagram["models"]>[number]) =>
			model.type === "atomic" &&
			EF_CODE_GENERATION_ROLES.includes(
				(model.role ?? "") as (typeof EF_CODE_GENERATION_ROLES)[number],
			),
		[],
	);

	const aiCodeGenerationModels = aiDiagram
		? aiDiagram.models.filter(shouldGenerateCodeForEFModel)
		: [];
	const aiCodeGenerationTotal = aiCodeGenerationModels.length;

	const createExperimentalFrame = async () => {
		if (!modelId || !targetModel) return;
		const trimmedName = newFrameName.trim();
		const roomName = trimmedName
			? `Room - ${trimmedName.replace(/^Room\s*-\s*/i, "")}`
			: `Room - ${targetModel.name}`;

		setIsCreating(true);
		try {
			const createdModelResponse = await client.POST("/model", {
				body: {
					code: "",
					components: [
						{
							instanceId: "M",
							instanceMetadata: {
								keyword: ["model-under-test"],
								modelRole: targetModel.type,
								position: { x: 40, y: 40 },
								style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
							},
							modelId: targetModel.id,
						},
					],
					connections: [],
					description: `Experimental frame for model ${targetModel.name}`,
					language: "python",
					libId: targetModel.libId,
					metadata: {
						keyword: ["experimental-frame"],
						modelRole: "experimental-frame",
						position: { x: 0, y: 0 },
						style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
					},
					name: roomName,
					ports: [],
					type: "coupled",
				},
			});

			if (!createdModelResponse.data) {
				throw new Error(
					"Failed to create coupled model for experimental frame.",
				);
			}

			const efResponse = await client.POST("/experimental-frame", {
				body: {
					frameModelId: createdModelResponse.data.id,
					targetModelId: modelId,
				},
			});

			if (!efResponse.data) {
				throw new Error("Failed to create experimental frame link.");
			}

			toast({
				description: "Coupled model and EF link were created successfully.",
				title: "Experimental frame created",
			});
			setNewFrameName("");
			await mutate();
		} catch (error) {
			toast({
				description: (error as Error).message,
				title: "Failed to create experimental frame",
				variant: "destructive",
			});
		} finally {
			setIsCreating(false);
		}
	};

	const handleGenerateWithAI = async () => {
		if (!modelId || !targetModel || !aiPrompt.trim()) return;

		const result = await generateEFStructure({
			roomName: aiRoomName.trim()
				? `Room - ${aiRoomName.trim().replace(/^Room\s*-\s*/i, "")}`
				: `Room - ${targetModel.name}`,
			targetModelId: modelId,
			userPrompt: aiPrompt.trim(),
		});

		if (!result) {
			toast({
				description:
					aiError ??
					"The AI could not generate an experimental frame structure.",
				title: "AI generation failed",
				variant: "destructive",
			});
			return;
		}

		const { diagram: normalizedDiagram, errors: replacementErrors } =
			replaceGeneratedMutPlaceholder(result, targetModel);
		if (replacementErrors.length > 0) {
			toast({
				description: replacementErrors[0],
				title: "Invalid EF structure",
				variant: "destructive",
			});
			return;
		}

		setAiDiagram(normalizedDiagram);
		setAiMode("structure");
		setCurrentAICodeModelIndex(0);
		toast({
			description: `${normalizedDiagram.models.length} model(s) generated by AI`,
			title: "EF structure generated",
		});
	};

	const handleValidateAIStructure = () => {
		if (!aiDiagram || !targetModel) return;

		const validationErrors = validateGeneratedMutConnections(
			aiDiagram,
			targetModel,
		);
		if (validationErrors.length > 0) {
			toast({
				description: validationErrors.slice(0, 2).join(" "),
				title: "Structure validation failed",
				variant: "destructive",
			});
			return;
		}

		toast({
			description: "MUT placeholder was replaced and ports are consistent.",
			title: "Structure validated",
		});
		setAiMode("code");
		setCurrentAICodeModelIndex(0);
	};

	const handleRegenerateWithAI = async () => {
		if (!modelId || !targetModel || !aiPrompt.trim()) return;
		await handleGenerateWithAI();
	};

	const handleAICodeGenerated = useCallback((modelId: string, code: string) => {
		setAiDiagram((previousDiagram) => {
			if (!previousDiagram) return previousDiagram;
			return {
				...previousDiagram,
				models: previousDiagram.models.map((model) =>
					model.id === modelId
						? { ...model, code, codeGenerated: true }
						: model,
				),
			};
		});
	}, []);

	const handleAICodeChange = useCallback((modelId: string, code: string) => {
		setAiDiagram((previousDiagram) => {
			if (!previousDiagram) return previousDiagram;
			return {
				...previousDiagram,
				models: previousDiagram.models.map((model) =>
					model.id === modelId ? { ...model, code } : model,
				),
			};
		});
	}, []);

	const handleAIModelValidated = useCallback(() => {
		setCurrentAICodeModelIndex((previousIndex) => {
			const nextIndex = previousIndex + 1;
			if (aiCodeGenerationTotal > 0 && nextIndex >= aiCodeGenerationTotal) {
				toast({
					description: "All G/T/A models were generated and validated.",
					title: "Code generation completed",
				});
			}
			return nextIndex;
		});
	}, [aiCodeGenerationTotal, toast]);

	const isAICodeGenerationComplete =
		aiMode === "code" && currentAICodeModelIndex >= aiCodeGenerationTotal;

	const handleSaveAssistedExperimentalFrame = async () => {
		if (!aiDiagram || !targetModel || !modelId) return;

		if (!isAICodeGenerationComplete) {
			toast({
				description: "Validate all G/T/A models before saving the assisted EF.",
				title: "Code generation not completed",
				variant: "destructive",
			});
			return;
		}

		const validationErrors = validateGeneratedMutConnections(
			aiDiagram,
			targetModel,
		);
		if (validationErrors.length > 0) {
			toast({
				description: validationErrors.slice(0, 2).join(" "),
				title: "Structure validation failed",
				variant: "destructive",
			});
			return;
		}

		const rootModelId =
			aiDiagram.rootModelId ??
			aiDiagram.models.find((model) => model.role === "experimental-frame")?.id;
		if (!rootModelId) {
			toast({
				description: "Missing root experimental frame model.",
				title: "Save failed",
				variant: "destructive",
			});
			return;
		}

		setIsSavingAssisted(true);
		try {
			const payload: components["schemas"]["request.ExperimentalFrameRequest"] =
				{
					connections: aiDiagram.connections.map((connection) => ({
						from: {
							model: connection.from?.model ?? "",
							port: connection.from?.port ?? "",
						},
						to: {
							model: connection.to?.model ?? "",
							port: connection.to?.port ?? "",
						},
					})),
					libraryId: targetModel.libId ?? libraryId,
					models: aiDiagram.models.map((model) => ({
						code: model.code ?? "",
						components: model.components ?? [],
						id: model.id,
						name: model.name,
						ports: [
							...model.ports.in.map((portName) => ({
								name: portName,
								type: "in" as const,
							})),
							...model.ports.out.map((portName) => ({
								name: portName,
								type: "out" as const,
							})),
						],
						role: model.role,
						type: model.type,
					})),
					modelUnderTestId: aiDiagram.modelUnderTestId ?? targetModel.id,
					roomName: aiDiagram.name,
					rootModelId,
					targetModelId: modelId,
				};

			const { data: saveData, error: saveError } = await client.POST(
				"/experimental-frame",
				{
					body: payload,
				},
			);
			if (saveError || !saveData) {
				throw new Error(
					extractApiErrorMessage(saveError) ??
						"Failed to save assisted experimental frame.",
				);
			}

			toast({
				description:
					"EF models, links, and experimental frame association were created.",
				title: "Assisted experimental frame saved",
			});

			await Promise.all([mutate(), mutateModels()]);
			const frameModelId = saveData.frameModelId;
			if (frameModelId) {
				navigate(`/library/${libraryId}/model/${frameModelId}`);
			}
		} catch (error) {
			toast({
				description: (error as Error).message,
				title: "Failed to save assisted EF",
				variant: "destructive",
			});
		} finally {
			setIsSavingAssisted(false);
		}
	};

	if (isLoadingTargetModel || isLoadingLibrary || isLoadingFrames) {
		return (
			<div className="flex items-center justify-center h-screen w-full">
				<Loader className="animate-spin w-10 h-10 text-foreground" />
			</div>
		);
	}

	if (!targetModel || !modelId || !libraryId) {
		return <div>Modele non trouve</div>;
	}

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					{
						href: `/library/${libraryId}`,
						label: library?.title ?? "Bibliotheque",
					},
					{
						href: `/library/${libraryId}/model/${modelId}`,
						label: targetModel.name ?? "Modele",
					},
					{ label: "Validation" },
				]}
				showModeToggle
				showNavActions={false}
			/>

			<div className="flex-1 p-6 overflow-auto space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Assisted Mode (AI)</CardTitle>
						<CardDescription>
							Describe your validation objective to generate an EF structure
							around the model under test.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<Input
								disabled={isGeneratingAIStructure}
								onChange={(e) => setAiRoomName(e.target.value)}
								placeholder="EF name (optional)"
								value={aiRoomName}
							/>
							<Button
								disabled={isGeneratingAIStructure || !aiPrompt.trim()}
								onClick={handleGenerateWithAI}
							>
								<Sparkles />
								{isGeneratingAIStructure
									? "Generating..."
									: "Generate EF with AI"}
							</Button>
						</div>
						<Textarea
							className="min-h-[120px]"
							disabled={isGeneratingAIStructure}
							onChange={(e) => setAiPrompt(e.target.value)}
							placeholder="Example: I need 2 generators to stress input A and 1 acceptor to verify latency threshold on output B..."
							value={aiPrompt}
						/>
						{aiError && (
							<Alert variant="destructive">AI error: {aiError}</Alert>
						)}
					</CardContent>
				</Card>

				{aiDiagram && (
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between gap-3">
								<div>
									<CardTitle className="text-lg">
										AI Generated Structure: {aiDiagram.name}
									</CardTitle>
									<CardDescription>
										{aiMode === "structure"
											? "Review and validate structure before behavior generation."
											: "Generate behavior code for G/T/A models only."}
									</CardDescription>
								</div>
								{aiMode === "code" && (
									<div className="flex items-center gap-2">
										<Button
											disabled={isSavingAssisted}
											onClick={() => setAiMode("structure")}
											variant="outline"
										>
											Back to structure
										</Button>
										<Button
											disabled={isSavingAssisted || !isAICodeGenerationComplete}
											onClick={handleSaveAssistedExperimentalFrame}
										>
											{isSavingAssisted ? "Saving..." : "Save assisted EF"}
										</Button>
									</div>
								)}
							</div>
						</CardHeader>
						<CardContent className="h-[620px] p-0 overflow-hidden">
							{aiMode === "structure" ? (
								<StructureEditor
									diagram={aiDiagram}
									onDiagramChange={setAiDiagram}
									onRegenerate={handleRegenerateWithAI}
									onValidate={handleValidateAIStructure}
								/>
							) : (
								<CodeGenerationPanel
									atomicModelFilter={shouldGenerateCodeForEFModel}
									currentModelIndex={currentAICodeModelIndex}
									diagram={aiDiagram}
									excludeFromContextModelIds={[
										aiDiagram.modelUnderTestId ?? targetModel.id,
									]}
									onCodeChange={handleAICodeChange}
									onCodeGenerated={handleAICodeGenerated}
									onModelValidated={handleAIModelValidated}
								/>
							)}
						</CardContent>
					</Card>
				)}

				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Experimental Frames</h1>
						<p className="text-muted-foreground text-sm">
							Model: {targetModel.name}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Input
							className="w-72"
							disabled={isCreating}
							onChange={(e) => setNewFrameName(e.target.value)}
							placeholder="EF Name (eg. Validation Charge)"
							value={newFrameName}
						/>
						<Button disabled={isCreating} onClick={createExperimentalFrame}>
							<Plus />
							{isCreating ? "Creating..." : "Create Experimental Frame"}
						</Button>
					</div>
				</div>

				{framesError && (
					<Alert variant="destructive">
						Failed to load experimental frames for this model.
					</Alert>
				)}

				{!frames || frames.length === 0 ? (
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								No experimental frame yet
							</CardTitle>
							<CardDescription>
								Create the first EF to start validation scenarios for this
								model.
							</CardDescription>
						</CardHeader>
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
						{frames.map((frame) => {
							const frameId = frame.frameModelId ?? "";
							const details = frameDetailsById[frameId];
							return (
								<Card key={frame.id}>
									<CardHeader>
										<CardTitle className="text-lg">
											{details?.name ?? "Experimental Frame"}
										</CardTitle>
										<CardDescription>Frame model ID: {frameId}</CardDescription>
									</CardHeader>
									<CardContent className="space-y-1 text-sm text-muted-foreground">
										<div className="flex items-center gap-2 text-foreground">
											<ShieldCheck className="h-4 w-4" />
											<span>EF</span>
											<GaugeCircle className="h-4 w-4" />
											<span>G</span>
											<Shuffle className="h-4 w-4" />
											<span>T</span>
											<CheckCircle2 className="h-4 w-4" />
											<span>A</span>
										</div>
										<p>EF ID: {frame.id}</p>
										<p>Target model ID: {frame.targetModelId}</p>
									</CardContent>
									<CardFooter>
										<Button
											onClick={() =>
												navigate(`/library/${libraryId}/model/${frameId}`)
											}
											variant="outline"
										>
											Open frame model
										</Button>
									</CardFooter>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
