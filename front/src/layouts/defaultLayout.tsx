import { AppSidebar } from "../components/nav/app-sidebar";
import { SidebarProvider } from "../components/ui/sidebar";
import { SidebarInset } from "../components/ui/sidebar";
import { Toaster } from "../components/ui/toaster";

export const DefaultLayout = ({ children }: { children: React.ReactNode }) => (
	<SidebarProvider>
		<AppSidebar />
		<SidebarInset>
			{children}
			<Toaster />
		</SidebarInset>
	</SidebarProvider>
);
