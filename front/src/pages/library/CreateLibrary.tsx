import LibraryForm from "@/components/custom/library/LibraryForm";
import NavHeader from "@/components/nav/nav-header";

export function CreateLibrary() {
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					{ label: "New Library" },
				]}
				showModeToggle={true}
				showNavActions={false}
			/>
			<LibraryForm />
		</div>
	);
}
