import type { Node } from "@xyflow/react";
import { Loader } from "lucide-react";
import { useCallback, useEffect } from "react";
import { type Options, useHotkeys } from "react-hotkeys-hook";
import { useNavigate, useParams } from "react-router-dom";
import useUndo from "use-undo";
import { client } from "@/api/client.ts";
import { ModelCodeEditor } from "@/components/custom/ModelCodeEditor";
import { ModelPropertyEditor } from "@/components/custom/ModelPropertyEditor";
import { ModelViewEditor } from "@/components/custom/ModelViewEditor";
import NavHeader from "@/components/nav/nav-header";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useToast } from "@/hooks/use-toast";
import { modelToReactflow } from "@/lib/modelToReactflow";
import { reactflowToModel } from "@/lib/reactflowToModel";
import { updateCodeBasedOnProperties } from "@/lib/updateCodeBasedOnProperties";
import { useGetLibraryById } from "@/queries/library/useGetLibraryById";
import { useGetModelByIdRecursive } from "@/queries/model/useGetModelByIdRecursive";
import { useGetModels } from "@/queries/model/useGetModels";
import type { ReactFlowInput, ReactFlowModelData } from "@/types";

const hotkeyOptions: Options = {
	document,
	enableOnContentEditable: true,
	enableOnFormTags: true,
	keydown: true,
	preventDefault: true,
};

export function EditModel() {
	const { libraryId, modelId } = useParams<{
		libraryId: string;
		modelId: string;
	}>();
	const navigate = useNavigate();

	const { data, error, isLoading, mutate } = useGetModelByIdRecursive(
		modelId
			? {
					params: { path: { id: modelId ?? "" } },
				}
			: null,
	);
	const { data: dataLib, isLoading: isLoadingLib } = useGetLibraryById(
		libraryId
			? {
					params: { path: { id: libraryId ?? "" } },
				}
			: null,
	);
	const { mutate: mutateModels } = useGetModels();
	const { toast } = useToast();
	const [structureState, { set: setStructure, undo, redo }] = useUndo<
		ReactFlowInput | undefined
	>(undefined, { useCheckpoints: true });
	const structure = structureState.present;

	useHotkeys(
		["ctrl+s", "meta+s"],
		(e) => {
			e.preventDefault();
			saveModelChange();
		},
		hotkeyOptions,
	);

	useHotkeys(
		["ctrl+w", "meta+w", "ctrl+z", "meta+z"],
		(e) => {
			e.preventDefault();
			undo();
		},
		hotkeyOptions,
	);

	useHotkeys(
		["ctrl+shift+w", "meta+shift+w", "ctrl+shift+z", "meta+shift+z"],
		(e) => {
			e.preventDefault();
			redo();
		},
		hotkeyOptions,
	);

	useEffect(() => {
		if (data && modelId) {
			const tmp = modelToReactflow(data);
			tmp.nodes.sort((a, b) => a.id.length - b.id.length);
			setStructure(tmp);
		}
	}, [data, modelId, setStructure]);

	const handleStructureChange = useCallback(
		(newStructure: ReactFlowInput) => {
			setStructure(newStructure, true);
		},
		[setStructure],
	);

	const saveModelChange = async (): Promise<void> => {
		if (!structure || !modelId) return;

		try {
			const modelToSave = reactflowToModel(structure).find(
				(model) => model.id === modelId,
			);
			if (!modelToSave) {
				toast({
					description: "Modèle non trouvé dans la structure",
					title: "Erreur",
					variant: "destructive",
				});
				return;
			}

			const response = await client.PATCH("/model/{id}", {
				body: {
					code: modelToSave.code,
					components: modelToSave.components,
					connections: modelToSave.connections,
					description: modelToSave.description,
					metadata: modelToSave.metadata,
					name: modelToSave.name,
					ports: modelToSave.ports,
					type: modelToSave.type,
				},
				params: {
					path: {
						id: modelId,
					},
				},
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			toast({
				title: "Modèle sauvegardé avec succès",
			});

			await Promise.all([mutate(), mutateModels()]);
		} catch (error) {
			toast({
				description: (error as Error).message,
				title: "Erreur lors de la sauvegarde",
				variant: "destructive",
			});
		}
	};

	const simulateModel = async (): Promise<void> => {
		if (!modelId || !libraryId) return;
		navigate(`/library/${libraryId}/model/${modelId}/simulate`);
	};
	const validateModel = async (): Promise<void> => {
		if (!modelId || !libraryId) return;
		navigate(`/library/${libraryId}/model/${modelId}/validate`);
	};
	const deployWebApp = async (): Promise<void> => {
		if (!modelId || !libraryId) return;
		navigate(`/library/${libraryId}/model/${modelId}/webapp`);
	};
	const onChangeProperty = (updatedNode: Node<ReactFlowModelData>) => {
		// Structure actuel : structureState.present ou structure (comme dans la réponse précédente)
		if (!structure) return;

		const newStructure = {
			...structure,
			nodes: structure.nodes.map((node) =>
				node.id === updatedNode.id
					? updateCodeBasedOnProperties(updatedNode)
					: node,
			),
		};

		setStructure(newStructure, true); // Pas de callback !
	};

	const onChangeCode = (newCode: string, codeID: string) => {
		if (!structure) return;

		const newStructure = {
			...structure,
			nodes: structure.nodes.map((node) =>
				node.id === codeID
					? {
							...node,
							data: {
								...node.data,
								code: newCode,
							},
						}
					: node,
			),
		};

		setStructure(newStructure);
	};

	if (isLoading || isLoadingLib) {
		return (
			<div className="flex items-center justify-center h-screen w-full">
				<Loader className="animate-spin w-10 h-10 text-foreground" />
			</div>
		);
	}

	if (error) return <div>Erreur lors du chargement.</div>;
	if (!data || !structure) return null;

	const mainModel = structure.nodes.find((m) => m.id === modelId);

	const selectedModel = structure.nodes.find(({ selected }) => selected);

	const disableCustomization =
		!!selectedModel && !!mainModel && selectedModel.id !== mainModel.id;

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					{
						href: `/library/${dataLib?.id}`,
						label: dataLib?.title ?? "Unknown library",
					},
					{ label: mainModel?.data.label ?? "Edit Model" },
				]}
				deployFunction={deployWebApp}
				saveFunction={saveModelChange}
				showModeToggle
				showNavActions
				simulateFunction={simulateModel}
				validateFunction={validateModel}
			/>

			{mainModel?.data.modelType === "atomic" ? (
				<ResizablePanelGroup direction="horizontal">
					<ResizablePanel defaultSize={50} minSize={20}>
						<ModelCodeEditor
							code={mainModel.data.code}
							modelId={mainModel.id}
							onCodeChange={onChangeCode}
						/>
					</ResizablePanel>

					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={30} minSize={20}>
						<ModelViewEditor
							models={structure}
							onChange={handleStructureChange}
						/>
					</ResizablePanel>
					<ResizableHandle withHandle />

					<ResizablePanel defaultSize={20} minSize={20}>
						<ModelPropertyEditor
							allowParameterValueEdit={disableCustomization}
							disabled={disableCustomization}
							model={selectedModel ?? mainModel}
							onChange={onChangeProperty}
						/>
					</ResizablePanel>
				</ResizablePanelGroup>
			) : null}

			{mainModel?.data.modelType === "coupled" ? (
				<ResizablePanelGroup direction="horizontal">
					<ResizablePanel defaultSize={70} minSize={20}>
						<ModelViewEditor
							models={structure}
							onChange={handleStructureChange}
						/>
					</ResizablePanel>
					<ResizableHandle withHandle />

					<ResizablePanel defaultSize={30} minSize={20}>
						<ModelPropertyEditor
							allowParameterValueEdit={disableCustomization}
							disabled={disableCustomization}
							model={selectedModel ?? mainModel}
							onChange={onChangeProperty}
						/>
					</ResizablePanel>
				</ResizablePanelGroup>
			) : null}
		</div>
	);
}
