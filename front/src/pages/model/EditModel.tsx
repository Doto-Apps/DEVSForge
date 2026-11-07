import type { Node } from "@xyflow/react";
import { Loader } from "lucide-react";
import { useCallback, useEffect } from "react";
import { type Options, useHotkeys } from "react-hotkeys-hook";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkbench } from "@/providers/WorkbenchProvider";

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
	const workbench = useWorkbench();
	const tab = workbench.tabs.find((t) => t.id === modelId);
	const structure = tab?.draft;
	const setStructure = useCallback(
		(value: ReactFlowInput, checkpoint = false) => {
			if (modelId) workbench.update(modelId, value, checkpoint);
		},
		[modelId, workbench.update],
	);
	const undo = () => modelId && workbench.undo(modelId);
	const redo = () => modelId && workbench.undo(modelId, true);

	useHotkeys(
		["ctrl+z", "meta+z"],
		(e) => {
			if ((e.target as HTMLElement)?.closest(".monaco-editor")) return;
			e.preventDefault();
			undo();
		},
		hotkeyOptions,
	);

	useHotkeys(
		["ctrl+shift+z", "meta+shift+z"],
		(e) => {
			if ((e.target as HTMLElement)?.closest(".monaco-editor")) return;
			e.preventDefault();
			redo();
		},
		hotkeyOptions,
	);

	useEffect(() => {
		if (data && modelId) {
			const tmp = modelToReactflow(data);
			tmp.nodes.sort((a, b) => a.id.length - b.id.length);
			workbench.open({
				id: modelId,
				libraryId: libraryId ?? "",
				libraryName: dataLib?.title ?? "Library",
				name: data.find((m) => m.id === modelId)?.name ?? "Model",
				kind: data.find((m) => m.id === modelId)?.type ?? "atomic",
				integration: data.find((m) => m.id === modelId)?.integrationId,
				draft: tmp,
			});
		}
	}, [data, modelId, libraryId, dataLib?.title, workbench.open]);

	const handleStructureChange = useCallback(
		(newStructure: ReactFlowInput) => {
			setStructure(newStructure, true);
		},
		[setStructure],
	);

	const saveModelChange = useCallback(async (): Promise<void> => {
		if (!structure || !modelId) return;

		try {
			await workbench.save(modelId);

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
	}, [structure, modelId, workbench.save, toast, mutate, mutateModels]);

	useEffect(() => {
		const onSaveKeyDown = (event: KeyboardEvent) => {
			if (
				!(event.metaKey || event.ctrlKey) ||
				event.altKey ||
				event.shiftKey ||
				event.isComposing ||
				event.key.toLowerCase() !== "s"
			)
				return;

			event.preventDefault();
			event.stopPropagation();
			if (!event.repeat) void saveModelChange();
		};

		// Capture before Monaco handles the key or stops it reaching document hotkeys.
		window.addEventListener("keydown", onSaveKeyDown, true);
		return () => window.removeEventListener("keydown", onSaveKeyDown, true);
	}, [saveModelChange]);

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
	const profileModel = data.find((model) => model.id === modelId);
	const modelLanguage = profileModel?.language;

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
				modelId={modelId}
				integrationId={profileModel?.integrationId}
				integrationVersion={profileModel?.integrationVersion}
				modelLanguage={
					mainModel?.data.modelType === "atomic" ? modelLanguage : undefined
				}
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
							language={modelLanguage}
							integrationId={profileModel?.integrationId}
							integrationVersion={profileModel?.integrationVersion}
							modelName={mainModel.data.label}
							modelId={mainModel.id}
							onCodeChange={onChangeCode}
							workbenchId={workbench.id}
						/>
					</ResizablePanel>

					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={30} minSize={20}>
						<ModelViewEditor
							key={modelId}
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
							key={modelId}
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
