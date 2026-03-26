import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";


const rootElement = document.getElementById("root");

if (!window.API_URL) {
	window.API_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
}
const App = lazy(() => import("./App.tsx"))

if (rootElement) {
	createRoot(rootElement).render(
		<StrictMode>
			<Suspense>
				<App />
			</Suspense>
		</StrictMode>,
	);
}