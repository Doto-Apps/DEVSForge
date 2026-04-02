import { useParams } from "react-router-dom";
import ModelForm from "@/components/custom/model/ModelForm";
import NavHeader from "@/components/nav/nav-header";
import { Alert } from "@/components/ui/alert";
import type { CreateLibraryRouteParams } from "@/routes/types";

export function CreateModel() {
	const params = useParams<CreateLibraryRouteParams>();

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					{ href: "#putlibrarypath", label: "putlibraryname" },
					{ label: "New Model" },
				]}
				showModeToggle={true}
				showNavActions={false}
			/>
			{params.libId ? (
				<ModelForm libId={params.libId} />
			) : (
				<Alert>Error on params ID</Alert>
			)}
		</div>
	);
}
