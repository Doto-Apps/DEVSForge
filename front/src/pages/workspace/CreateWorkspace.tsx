import WorkspaceForm from "@/components/custom/workspace/WorkspaceForm";
import NavHeader from "@/components/nav/nav-header";

export function CreateWorkspace() {
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Workspaces", href: "/workspace" },
					{ label: "New Workspace" },
				]}
				showNavActions={false}
				showModeToggle={true}
			/>
			<WorkspaceForm />
		</div>
	);
}
