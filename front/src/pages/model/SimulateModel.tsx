import { Loader } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { SimulationPanel } from "@/components/custom/SimulationPanel";
import NavHeader from "@/components/nav/nav-header";
import { useGetLibraryById } from "@/queries/library/useGetLibraryById";
import { useGetModelById } from "@/queries/model/useGetModelById";
import { useGetModelByIdRecursive } from "@/queries/model/useGetModelByIdRecursive";

export function SimulateModel() {
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

	const { data: recursiveModels } = useGetModelByIdRecursive(
		modelId
			? {
					params: { path: { id: modelId } },
				}
			: null,
	);

	const { data: library, isLoading: isLoadingLib } = useGetLibraryById(
		libraryId
			? {
					params: { path: { id: libraryId } },
				}
			: null,
	);

	const modelNameById = useMemo(() => {
		const map: Record<string, string> = {};
		for (const item of recursiveModels ?? []) {
			if (item.id && item.name) {
				map[item.id] = item.name;
			}
		}
		if (model?.id && model?.name) {
			map[model.id] = model.name;
		}
		return map;
	}, [recursiveModels, model?.id, model?.name]);

	if (isLoadingModel || isLoadingLib) {
		return (
			<div className="flex items-center justify-center h-screen w-full">
				<Loader className="animate-spin w-10 h-10 text-foreground" />
			</div>
		);
	}

	if (!model || !modelId) {
		return <div>Model not found</div>;
	}

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Libraries", href: "/library" },
					{
						label: library?.title ?? "Library",
						href: `/library/${libraryId}`,
					},
					{
						label: model.name ?? "Model",
						href: `/library/${libraryId}/model/${modelId}`,
					},
					{ label: "Simulation" },
				]}
				showNavActions={false}
				showModeToggle
			/>

			<div className="flex-1 p-6 overflow-auto">
				<SimulationPanel
					modelId={modelId}
					modelName={model.name}
					modelNameById={modelNameById}
				/>
			</div>
		</div>
	);
}
