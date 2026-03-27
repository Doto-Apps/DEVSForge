"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import "@xyflow/react/dist/base.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { DefaultLayout } from "@/layouts/defaultLayout";
import { MinimalLayout } from "@/layouts/minimalLayout";
import { Login } from "@/pages/login/login";
import { Register } from "@/pages/register/register";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import {
	Navigate,
	Route,
	BrowserRouter as Router,
	Routes,
} from "react-router-dom";

import { GeneratorFlow } from "./pages/generator/GeneratorFlow";
import { GettingStarted } from "./pages/help/GettingStarted";
import { HowItWorks } from "./pages/help/HowItWorks";
import { ModelerHome } from "./pages/home/ModelerHome";
import { CreateLibrary } from "./pages/library/CreateLibrary";
import { CreateModel } from "./pages/model/CreateModel";
import { EditModel } from "./pages/model/EditModel";
import { SimulateModel } from "./pages/model/SimulateModel";
import { TestModel } from "./pages/model/TestModel";
import { ValidationModel } from "./pages/model/ValidationModel";
import { AccountSettings } from "./pages/settings/AccountSettings";
import { WebAppBuilder } from "./pages/webapp/WebAppBuilder";
import { DnDProvider } from "./providers/DnDContext";
import { WebAppDeployment } from "./pages/webapp/WebAppDeployment";
import { WebAppDeployments } from "./pages/webapp/WebAppDeployments";

const Main = () => {
	const { isAuthenticated, isInitialized } = useAuth();

	if (!isInitialized) return null;

	return !isAuthenticated ? (
		<MinimalLayout>
			<Routes>
				<Route element={<Login />} path="/login" />
				<Route path="/register" element={<Register />} />
				<Route path="*" element={<Navigate to="/login" />} />
			</Routes>
		</MinimalLayout>
	) : (
		<DefaultLayout>
			<Routes>
				<Route path="/library/new" element={<CreateLibrary />} />
				<Route path="/library/:libId/model/new" element={<CreateModel />} />
				<Route
					path="/library/:libraryId/model/:modelId"
					element={<EditModel />}
				/>
				<Route
					path="/library/:libraryId/model/:modelId/simulate"
					element={<SimulateModel />}
				/>
				<Route
					path="/library/:libraryId/model/:modelId/validate"
					element={<ValidationModel />}
				/>
				<Route
					path="/library/:libraryId/model/:modelId/webapp"
					element={<WebAppBuilder />}
				/>
				<Route path="/webapps" element={<WebAppDeployments />} />
				<Route path="/webapps/:deploymentId" element={<WebAppDeployment />} />

				<Route path="/devs-generator" element={<GeneratorFlow />} />
				<Route path="/getting-started" element={<GettingStarted />} />
				<Route path="/how-it-works" element={<HowItWorks />} />
				<Route path="/settings" element={<AccountSettings />} />

				<Route path="/" element={<ModelerHome />} />
				<Route path="/test-model" element={<TestModel />} />

				<Route path="*" element={<Navigate to="/" />} />
			</Routes>
		</DefaultLayout>
	);
};

const App = () => (
	<Router>
		<AuthProvider>
			<ReactFlowProvider fitView>
				<DnDProvider>
					<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
						<SidebarProvider>
							<SidebarInset>
								<Main />
								<Toaster />
							</SidebarInset>
						</SidebarProvider>
					</ThemeProvider>
				</DnDProvider>
			</ReactFlowProvider>
		</AuthProvider>
	</Router>
);

export default App;
