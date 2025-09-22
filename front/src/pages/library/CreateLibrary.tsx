import LibraryForm from "@/components/custom/library/LibraryForm";
import NavHeader from "@/components/nav/nav-header";

export function CreateLibrary() {
	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Libraries", href: "/library" },
					{ label: "New Library" },
				]}
				showNavActions={false}
				showModeToggle={true}
			/>
			<LibraryForm />
		</div>
	);
}
