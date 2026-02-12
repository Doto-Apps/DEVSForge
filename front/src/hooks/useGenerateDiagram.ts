import { client } from "@/api/client";
import { llmResponseToGeneratedDiagram } from "@/lib/llmToReactFlow";
import type { GenerateDiagramRequest, GeneratedDiagram } from "@/types";
import { useState } from "react";

type UseGenerateDiagramResult = {
	generateDiagram: (
		request: GenerateDiagramRequest,
	) => Promise<GeneratedDiagram | null>;
	isLoading: boolean;
	error: string | null;
};

export const useGenerateDiagram = (): UseGenerateDiagramResult => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateDiagram = async (
		request: GenerateDiagramRequest,
	): Promise<GeneratedDiagram | null> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await client.POST("/ai/generate-diagram", {
				body: request,
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			const generatedDiagram = llmResponseToGeneratedDiagram(
				response.data,
				request.diagramName,
			);

			return generatedDiagram;
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "An error occurred";
			setError(errorMessage);
			return null;
		} finally {
			setIsLoading(false);
		}
	};

	return {
		generateDiagram,
		isLoading,
		error,
	};
};
