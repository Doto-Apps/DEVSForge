import { Loader } from "lucide-react";
import { useParams } from "react-router-dom";

import { SimulationPanel } from "@/components/custom/SimulationPanel";
import NavHeader from "@/components/nav/nav-header";
import { useGetLibraryById } from "@/queries/library/useGetLibraryById";
import { useGetModelById } from "@/queries/model/useGetModelById";

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

	const { data: library, isLoading: isLoadingLib } = useGetLibraryById(
		libraryId
			? {
					params: { path: { id: libraryId } },
				}
			: null,
	);

	if (isLoadingModel || isLoadingLib) {
		return (
			<div className="flex items-center justify-center h-screen w-full">
				<Loader className="animate-spin w-10 h-10 text-foreground" />
			</div>
		);
	}

	if (!model || !modelId) {
		return <div>Modèle non trouvé</div>;
	}

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Libraries", href: "/library" },
					{
						label: library?.title ?? "Bibliothèque",
						href: `/library/${libraryId}`,
					},
					{
						label: model.name ?? "Modèle",
						href: `/library/${libraryId}/model/${modelId}`,
					},
					{ label: "Simulation" },
				]}
				showNavActions={false}
				showModeToggle
			/>

			<div className="flex-1 p-6 overflow-auto">
				<SimulationPanel modelId={modelId} modelName={model.name} />
			</div>
		</div>
	);
}
