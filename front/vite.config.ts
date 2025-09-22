import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		host: "0.0.0.0", // Permet à Docker de servir l'application sur l'adresse du conteneur
		port: 5173,
		watch: {
			usePolling: true, // Nécessaire pour les environnements Docker
		},
	},
});
