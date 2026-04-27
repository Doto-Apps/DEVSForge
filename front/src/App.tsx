"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import "@xyflow/react/dist/base.css";
import {
	Navigate,
	Route,
	BrowserRouter as Router,
	Routes,
} from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { DefaultLayout } from "@/layouts/defaultLayout";
import { MinimalLayout } from "@/layouts/minimalLayout";
import { Login } from "@/pages/login/login";
import { Register } from "@/pages/register/register";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";

import { GeneratorFlow } from "./pages/generator/GeneratorFlow";
import { GettingStarted } from "./pages/help/GettingStarted";
import { HowItWorks } from "./pages/help/HowItWorks";
import { ModelerHome } from "./pages/home/ModelerHome";
import { CreateLibrary } from "./pages/library/CreateLibrary";
import { LibrariesHome } from "./pages/library/LibrariesHome";
import { CreateModel } from "./pages/model/CreateModel";
import { EditModel } from "./pages/model/EditModel";
import { SimulateModel } from "./pages/model/SimulateModel";
import { TestModel } from "./pages/model/TestModel";
import { ValidationModel } from "./pages/model/ValidationModel";
import { AccountSettings } from "./pages/settings/AccountSettings";
import { WebAppBuilder } from "./pages/webapp/WebAppBuilder";
import { WebAppDeployment } from "./pages/webapp/WebAppDeployment";
import { WebAppDeployments } from "./pages/webapp/WebAppDeployments";
import { DnDProvider } from "./providers/DnDContext";

const Main = () => {
	const { isAuthenticated, isInitialized } = useAuth();

	if (!isInitialized) return null;

	return !isAuthenticated ? (
		<MinimalLayout>
			<Routes>
				<Route element={<Login />} path="/login" />
				<Route element={<Register />} path="/register" />
				<Route element={<Navigate to="/login" />} path="*" />
			</Routes>
		</MinimalLayout>
	) : (
		<DefaultLayout>
			<Routes>
				<Route element={<CreateLibrary />} path="/library/new" />
				<Route element={<LibrariesHome />} path="/library" />
				<Route element={<LibrariesHome />} path="/library/:libraryId" />
				<Route element={<CreateModel />} path="/library/:libId/model/new" />
				<Route
					element={<EditModel />}
					path="/library/:libraryId/model/:modelId"
				/>
				<Route
					element={<SimulateModel />}
					path="/library/:libraryId/model/:modelId/simulate"
				/>
				<Route
					element={<ValidationModel />}
					path="/library/:libraryId/model/:modelId/validate"
				/>
				<Route
					element={<WebAppBuilder />}
					path="/library/:libraryId/model/:modelId/webapp"
				/>
				<Route element={<WebAppDeployments />} path="/webapps" />
				<Route element={<WebAppDeployment />} path="/webapps/:deploymentId" />

				<Route element={<GeneratorFlow />} path="/devs-generator" />
				<Route element={<GettingStarted />} path="/getting-started" />
				<Route element={<HowItWorks />} path="/how-it-works" />
				<Route element={<AccountSettings />} path="/settings" />

				<Route element={<ModelerHome />} path="/" />
				<Route element={<TestModel />} path="/test-model" />

				<Route element={<Navigate to="/" />} path="*" />
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
