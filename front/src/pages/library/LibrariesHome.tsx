import { Plus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { LibraryGallery } from "@/components/custom/library/LibraryGallery";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
export function LibrariesHome() {
	const { libraryId } = useParams();
	return (
		<div className="flex h-screen min-w-0 w-full flex-col">
			<NavHeader
				breadcrumbs={[
					{ href: "/library", label: "Libraries" },
					...(libraryId ? [{ label: "Collection" }] : []),
				]}
				showModeToggle
				showNavActions={false}
			/>
			<main className="flex-1 overflow-y-auto p-4 lg:p-6">
				<header className="mb-7 flex items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">Libraries</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Definitions, their ports, and the systems they make together.
						</p>
					</div>
					<Button asChild size="sm">
						<Link to="/library/new">
							<Plus />
							New library
						</Link>
					</Button>
				</header>
				<LibraryGallery key={libraryId ?? "all"} libraryId={libraryId} />
			</main>
		</div>
	);
}
