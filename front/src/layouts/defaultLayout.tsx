import { useAuth } from "@/providers/AuthProvider";
import { WorkbenchProvider } from "@/providers/WorkbenchProvider";
import { AppSidebar } from "../components/nav/app-sidebar";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar";
import { Toaster } from "../components/ui/toaster";

export const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
	const { user } = useAuth();
	return (
		<WorkbenchProvider key={user?.email ?? "loading"}>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					{children}
					<Toaster />
				</SidebarInset>
			</SidebarProvider>
		</WorkbenchProvider>
	);
};
