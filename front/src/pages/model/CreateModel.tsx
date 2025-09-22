import ModelForm from "@/components/custom/model/ModelForm";
import NavHeader from "@/components/nav/nav-header";
import { Alert } from "@/components/ui/alert";
import type { CreateLibraryRouteParams } from "@/routes/types";
import { useParams } from "react-router-dom";

export function CreateModel() {
	const params = useParams<CreateLibraryRouteParams>();

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ label: "Libraries", href: "/library" },
					{ label: "putlibraryname", href: "#putlibrarypath" },
					{ label: "New Model" },
				]}
				showNavActions={false}
				showModeToggle={true}
			/>
			{params.libId ? (
				<ModelForm libId={params.libId} />
			) : (
				<Alert>Error on params ID</Alert>
			)}
		</div>
	);
}
