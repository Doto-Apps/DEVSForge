import { fetchWithAuth } from "@/api/old/fetchWithAuth";
import type { DiagramDataType } from "@/types";

export const getDiagramById = async (
	diagramId: number,
	token: string | null | undefined,
): Promise<DiagramDataType> => {
	try {
		const url = `/data/diagrams/${diagramId}`;

		const response = await fetchWithAuth(
			import.meta.env.VITE_API_BASE_URL + url,
			token,
			{
				method: "GET",
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch diagram: ${response.statusText}`);
		}

		return response.json();
	} catch (error) {
		console.error("Error fetching diagram:", error);
		throw error;
	}
};
