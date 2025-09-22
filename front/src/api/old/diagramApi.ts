import type { DiagramDataType } from "@/types";
import { fetchWithAuth } from "./fetchWithAuth";

export interface DiagramPayload {
	diagramName: string;
	prompt: string;
}

export const generateDiagram = async (
	token: string | null | undefined,
	payload: DiagramPayload,
	onGenerate: (diagramData: DiagramDataType) => void,
	toast: (options: {
		description: string;
		variant?: "destructive" | "default";
	}) => void,
): Promise<void> => {
	try {
		const diagramResponse = await fetchWithAuth(
			import.meta.env.VITE_API_BASE_URL + "/ai/generate-diagram",
			token,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Important pour que le serveur sache que les données sont en JSON
				},
				body: JSON.stringify({
					diagramName: payload.diagramName,
					userPrompt: payload.prompt,
				}),
			},
		);

		const diagramData = await diagramResponse.json();

		console.log("diagramData");

		if (diagramResponse.ok) {
			toast({
				description: diagramData.message || "Diagram generated successfully!",
			});
			onGenerate({
				nodes: diagramData.nodes,
				edges: diagramData.edges,
				name: payload.diagramName,
				currentModel: 0,
				diagramId: 0,
				models: [],
			});
		} else {
			toast({
				description:
					diagramData.error ||
					"An error occurred while generating the diagram.",
				variant: "destructive",
			});
		}
	} catch (error) {
		console.error(error);
		toast({
			description: "Failed to reach the API during diagram generation.",
			variant: "destructive",
		});
	}
};

export const saveDiagram = async (
	diagramData: DiagramDataType,
	token: string | null | undefined,
): Promise<number> => {
	try {
		const url = "/data/save-diagram"; // Save a new diagram

		const method = "POST";

		const response = await fetchWithAuth(
			import.meta.env.VITE_API_BASE_URL + url,
			token,
			{
				method,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(diagramData),
			},
		);

		const diagram = await response.json();

		if (!response.ok) {
			throw new Error(`Failed to save diagram: ${response.statusText}`);
		}
		console.log("diagram", diagram);
		if (diagram.id) {
			return diagram.id;
		}

		return -1;
	} catch (error) {
		console.error("Error saving diagram:", error);
		throw error;
	}
};

export const getDiagrams = async (
	token: string | null | undefined,
	onFetch: (diagrams: { id: number; name: string }[]) => void,
	toast: (options: {
		description: string;
		variant?: "destructive" | "default";
	}) => void,
): Promise<void> => {
	try {
		const response = await fetch(
			import.meta.env.VITE_API_BASE_URL + "/data/get-all-diagrams",
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
			},
		);

		const data = await response.json();

		if (response.ok) {
			onFetch(data.diagrams);
		} else {
			toast({
				description: data.error || "Failed to retrieve diagrams.",
				variant: "destructive",
			});
		}
	} catch (error) {
		console.error("Error fetching diagrams:", error);
		toast({
			description: "Error connecting to the API.",
			variant: "destructive",
		});
	}
};

export interface ModelPayload {
	modelName: string;
	prompt: string;
	previousCodes: string[];
	modelType: string;
}

export const generateModel = async (
	token: string | null | undefined,
	payload: ModelPayload,
	onGenerate: (modelName: string, modelCode: string) => void,
	toast: (options: {
		description: string;
		variant?: "destructive" | "default";
	}) => void,
): Promise<void> => {
	try {
		const diagramResponse = await fetchWithAuth(
			import.meta.env.VITE_API_BASE_URL + "/ai/generate-model",
			token,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Important pour que le serveur sache que les données sont en JSON
				},
				body: JSON.stringify({
					modelName: payload.modelName,
					userPrompt: payload.prompt,
					previousModelsCode: payload.previousCodes,
					modelType: payload.modelType,
				}),
			},
		);
		const diagramData = await diagramResponse.json();

		if (diagramResponse.ok) {
			toast({
				description: diagramData.message || "Diagram generated successfully!",
			});
			onGenerate(payload.modelName, diagramData);
		} else {
			toast({
				description:
					diagramData.error ||
					"An error occurred while generating the diagram.",
				variant: "destructive",
			});
		}
	} catch (error) {
		console.error(error);
		toast({
			description: "Failed to reach the API during diagram generation.",
			variant: "destructive",
		});
	}
};

export const deleteDiagram = async (
	token: string | null | undefined,
	diagramId: number,
	onDelete: (deletedId: number) => void,
	toast: (options: {
		description: string;
		variant?: "destructive" | "default";
	}) => void,
): Promise<void> => {
	try {
		const response = await fetchWithAuth(
			import.meta.env.VITE_API_BASE_URL + `/data/delete-diagram/${diagramId}`,
			token,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		const data = await response.json();

		if (response.ok) {
			toast({
				description: data.message || "Diagram deleted successfully!",
			});
			onDelete(diagramId);
		} else {
			toast({
				description:
					data.error || "An error occurred while deleting the diagram.",
				variant: "destructive",
			});
		}
	} catch (error) {
		console.error(error);
		toast({
			description: "Failed to reach the API during diagram deletion.",
			variant: "destructive",
		});
	}
};
