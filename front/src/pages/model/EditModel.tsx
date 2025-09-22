import { Loader } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";

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
import type { ReactFlowInput, ReactFlowModelData } from "@/types";
import type { Node } from "@xyflow/react";
import { type Options, useHotkeys } from "react-hotkeys-hook";
import useUndo from "use-undo";

const hotkeyOptions: Options = {
	document,
	preventDefault: true,
	keydown: true,
	enableOnFormTags: true,
	enableOnContentEditable: true,
};

export function EditModel() {
	const { libraryId, modelId } = useParams<{
		libraryId: string;
		modelId: string;
	}>();

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
			console.log("Structure à sauvegarder en RF :", structure);
			const modelToSave = reactflowToModel(structure).find(
				(model) => model.id === modelId,
			);
			console.log("Structure pret a save", modelToSave);
			if (!modelToSave) {
				toast({
					title: "Erreur",
					description: "Modèle non trouvé dans la structure",
					variant: "destructive",
				});
				return;
			}

			const response = await client.PATCH("/model/{id}", {
				params: {
					path: {
						id: modelId,
					},
				},
				body: {
					code: modelToSave.code,
					description: modelToSave.description,
					name: modelToSave.name,
					type: modelToSave.type,
					components: modelToSave.components,
					connections: modelToSave.connections,
					ports: modelToSave.ports,
					metadata: modelToSave.metadata,
				},
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			toast({
				title: "Modèle sauvegardé avec succès",
			});

			await mutate();
		} catch (error) {
			toast({
				title: "Erreur lors de la sauvegarde",
				description: (error as Error).message,
				variant: "destructive",
			});
		}
	};

	const simulateModel = async (): Promise<void> => {
		if (!structure || !modelId) return;

		try {
			const response = await client.GET("/model/{id}/simulate", {
				params: { path: { id: modelId } },
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			console.log(response.data);
		} catch (error) {
			toast({
				title: "Erreur lors de la simulation",
				description: (error as Error).message,
				variant: "destructive",
			});
		}
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
					{ label: "Libraries", href: "/library" },
					{
						label: dataLib?.title ?? "Unknown library",
						href: `/library/${dataLib?.id}`,
					},
					{ label: mainModel?.data.label ?? "Edit Model" },
				]}
				showNavActions
				showModeToggle
				saveFunction={saveModelChange}
				simulateFunction={simulateModel}
			/>

			{mainModel?.data.modelType === "atomic" ? (
				<ResizablePanelGroup direction="horizontal">
					<ResizablePanel defaultSize={50} minSize={20}>
						<ModelCodeEditor
							code={mainModel.data.code}
							onCodeChange={onChangeCode}
							modelId={mainModel.id}
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
							model={selectedModel ?? mainModel}
							onChange={disableCustomization ? () => {} : onChangeProperty}
							disabled={disableCustomization}
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
							model={selectedModel ?? mainModel}
							onChange={disableCustomization ? () => {} : onChangeProperty}
							disabled={disableCustomization}
						/>
					</ResizablePanel>
				</ResizablePanelGroup>
			) : null}
		</div>
	);
}
