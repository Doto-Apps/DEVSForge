import { client } from "@/api/client";
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

	const dataField = payload["data"];
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
					name: roomName,
					description: `Experimental frame for model ${targetModel.name}`,
					code: "",
					type: "coupled",
					language: "python",
					libId: targetModel.libId,
					components: [
						{
							instanceId: "M",
							modelId: targetModel.id,
							instanceMetadata: {
								style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
								position: { x: 40, y: 40 },
								keyword: ["model-under-test"],
								modelRole: targetModel.type,
							},
						},
					],
					ports: [],
					connections: [],
					metadata: {
						style: { height: DEFAULT_NODE_SIZE, width: DEFAULT_NODE_SIZE },
						position: { x: 0, y: 0 },
						keyword: ["experimental-frame"],
						modelRole: "experimental-frame",
					},
				},
			});

			if (!createdModelResponse.data) {
				throw new Error(
					"Failed to create coupled model for experimental frame.",
				);
			}

			const efResponse = await client.POST("/experimental-frame", {
				body: {
					targetModelId: modelId,
					frameModelId: createdModelResponse.data.id,
				},
			});

			if (!efResponse.data) {
				throw new Error("Failed to create experimental frame link.");
			}

			toast({
				title: "Experimental frame created",
				description: "Coupled model and EF link were created successfully.",
			});
			setNewFrameName("");
			await mutate();
		} catch (error) {
			toast({
				title: "Failed to create experimental frame",
				description: (error as Error).message,
				variant: "destructive",
			});
		} finally {
			setIsCreating(false);
		}
	};

	const handleGenerateWithAI = async () => {
		if (!modelId || !targetModel || !aiPrompt.trim()) return;

		const result = await generateEFStructure({
			targetModelId: modelId,
			roomName: aiRoomName.trim()
				? `Room - ${aiRoomName.trim().replace(/^Room\s*-\s*/i, "")}`
				: `Room - ${targetModel.name}`,
			userPrompt: aiPrompt.trim(),
		});

		if (!result) {
			toast({
				title: "AI generation failed",
				description:
					aiError ??
					"The AI could not generate an experimental frame structure.",
				variant: "destructive",
			});
			return;
		}

		const { diagram: normalizedDiagram, errors: replacementErrors } =
			replaceGeneratedMutPlaceholder(result, targetModel);
		if (replacementErrors.length > 0) {
			toast({
				title: "Invalid EF structure",
				description: replacementErrors[0],
				variant: "destructive",
			});
			return;
		}

		setAiDiagram(normalizedDiagram);
		setAiMode("structure");
		setCurrentAICodeModelIndex(0);
		toast({
			title: "EF structure generated",
			description: `${normalizedDiagram.models.length} model(s) generated by AI`,
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
				title: "Structure validation failed",
				description: validationErrors.slice(0, 2).join(" "),
				variant: "destructive",
			});
			return;
		}

		toast({
			title: "Structure validated",
			description: "MUT placeholder was replaced and ports are consistent.",
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
					title: "Code generation completed",
					description: "All G/T/A models were generated and validated.",
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
				title: "Code generation not completed",
				description: "Validate all G/T/A models before saving the assisted EF.",
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
				title: "Structure validation failed",
				description: validationErrors.slice(0, 2).join(" "),
				variant: "destructive",
			});
			return;
		}

		const rootModelId =
			aiDiagram.rootModelId ??
			aiDiagram.models.find((model) => model.role === "experimental-frame")?.id;
		if (!rootModelId) {
			toast({
				title: "Save failed",
				description: "Missing root experimental frame model.",
				variant: "destructive",
			});
			return;
		}

		setIsSavingAssisted(true);
		try {
			const payload = {
				targetModelId: modelId,
				modelUnderTestId: aiDiagram.modelUnderTestId ?? targetModel.id,
				rootModelId,
				roomName: aiDiagram.name,
				libraryId: targetModel.libId ?? libraryId,
				models: aiDiagram.models.map((model) => ({
					id: model.id,
					name: model.name,
					type: model.type,
					role: model.role,
					code: model.code ?? "",
					components: model.components ?? [],
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
				})),
				connections: aiDiagram.connections.map((connection) => ({
					from: {
						model: connection.from.model,
						port: connection.from.port,
					},
					to: {
						model: connection.to.model,
						port: connection.to.port,
					},
				})),
			};

			const { data: saveData, error: saveError } = await client.POST(
				"/experimental-frame",
				{
				body: payload as unknown as Record<string, never>,
				},
			);
			if (saveError || !saveData) {
				throw new Error(
					extractApiErrorMessage(saveError) ??
						"Failed to save assisted experimental frame.",
				);
			}

			toast({
				title: "Assisted experimental frame saved",
				description:
					"EF models, links, and experimental frame association were created.",
			});

			await Promise.all([mutate(), mutateModels()]);
			const frameModelId = saveData.frameModelId;
			if (frameModelId) {
				navigate(`/library/${libraryId}/model/${frameModelId}`);
			}
		} catch (error) {
			toast({
				title: "Failed to save assisted EF",
				description: (error as Error).message,
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
					{ label: "Libraries", href: "/library" },
					{
						label: library?.title ?? "Bibliotheque",
						href: `/library/${libraryId}`,
					},
					{
						label: targetModel.name ?? "Modele",
						href: `/library/${libraryId}/model/${modelId}`,
					},
					{ label: "Validation" },
				]}
				showNavActions={false}
				showModeToggle
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
								placeholder="EF name (optional)"
								value={aiRoomName}
								onChange={(e) => setAiRoomName(e.target.value)}
								disabled={isGeneratingAIStructure}
							/>
							<Button
								onClick={handleGenerateWithAI}
								disabled={isGeneratingAIStructure || !aiPrompt.trim()}
							>
								<Sparkles />
								{isGeneratingAIStructure
									? "Generating..."
									: "Generate EF with AI"}
							</Button>
						</div>
						<Textarea
							placeholder="Example: I need 2 generators to stress input A and 1 acceptor to verify latency threshold on output B..."
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							className="min-h-[120px]"
							disabled={isGeneratingAIStructure}
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
											variant="outline"
											onClick={() => setAiMode("structure")}
											disabled={isSavingAssisted}
										>
											Back to structure
										</Button>
										<Button
											onClick={handleSaveAssistedExperimentalFrame}
											disabled={isSavingAssisted || !isAICodeGenerationComplete}
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
									onValidate={handleValidateAIStructure}
									onRegenerate={handleRegenerateWithAI}
								/>
							) : (
								<CodeGenerationPanel
									diagram={aiDiagram}
									currentModelIndex={currentAICodeModelIndex}
									onCodeGenerated={handleAICodeGenerated}
									onModelValidated={handleAIModelValidated}
									onCodeChange={handleAICodeChange}
									atomicModelFilter={shouldGenerateCodeForEFModel}
									excludeFromContextModelIds={[
										aiDiagram.modelUnderTestId ?? targetModel.id,
									]}
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
							placeholder="EF Name (eg. Validation Charge)"
							value={newFrameName}
							onChange={(e) => setNewFrameName(e.target.value)}
							className="w-72"
							disabled={isCreating}
						/>
						<Button onClick={createExperimentalFrame} disabled={isCreating}>
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
											variant="outline"
											onClick={() =>
												navigate(`/library/${libraryId}/model/${frameId}`)
											}
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
