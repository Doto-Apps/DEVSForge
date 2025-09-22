import DiagramForm from "@/components/custom/diagram/DiagramForm";
import NavHeader from "@/components/nav/nav-header";
import { Alert } from "@/components/ui/alert";
import type { CreateDiagramRouteParams } from "@/routes/types";
import { useParams } from "react-router-dom";

export function CreateDiagram() {
	const params = useParams<CreateDiagramRouteParams>();
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Workspaces", href: "/workspace" },
					{ label: "Diagrams", href: "/diagrams" },
					{ label: "New Diagram" },
				]}
				showNavActions={false}
				showModeToggle={true}
			/>
			{params.workspaceId ? (
				<DiagramForm workspaceId={params.workspaceId} />
			) : (
				<Alert>Error on params ID</Alert>
			)}
		</div>
	);
}
