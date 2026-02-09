import { client } from "@/api/client";
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
import { useToast } from "@/hooks/use-toast";
import { useGetLibraryById } from "@/queries/library/useGetLibraryById";
import { useGetExperimentalFramesByModel } from "@/queries/model/useGetExperimentalFramesByModel";
import { useGetModelById } from "@/queries/model/useGetModelById";
import {
	CheckCircle2,
	GaugeCircle,
	Loader,
	Plus,
	ShieldCheck,
	Shuffle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const DEFAULT_NODE_SIZE = 200;

type FrameModelDetails = {
	id: string;
	name: string;
};

export function ValidationModel() {
	const { libraryId, modelId } = useParams<{
		libraryId: string;
		modelId: string;
	}>();
	const navigate = useNavigate();
	const { toast } = useToast();
	const [isCreating, setIsCreating] = useState(false);
	const [newFrameName, setNewFrameName] = useState("");
	const [frameDetailsById, setFrameDetailsById] = useState<
		Record<string, FrameModelDetails>
	>({});

	const { data: targetModel, isLoading: isLoadingTargetModel } = useGetModelById(
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
				throw new Error("Failed to create coupled model for experimental frame.");
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
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Experimental Frames</h1>
						<p className="text-muted-foreground text-sm">
							Model: {targetModel.name}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Input
							placeholder="Nom du EF (ex: Validation Charge)"
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
							<CardTitle className="text-lg">No experimental frame yet</CardTitle>
							<CardDescription>
								Create the first EF to start validation scenarios for this model.
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
