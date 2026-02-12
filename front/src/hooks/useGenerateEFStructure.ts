import { client } from "@/api/client";
import { efStructureResponseToGeneratedDiagram } from "@/lib/llmToReactFlow";
import type {
	GenerateEFStructureRequest,
	GeneratedDiagram,
} from "@/types/generator";
import { useState } from "react";

type UseGenerateEFStructureResult = {
	generateEFStructure: (
		request: GenerateEFStructureRequest,
	) => Promise<GeneratedDiagram | null>;
	isLoading: boolean;
	error: string | null;
};

export const useGenerateEFStructure = (): UseGenerateEFStructureResult => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateEFStructure = async (
		request: GenerateEFStructureRequest,
	): Promise<GeneratedDiagram | null> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await client.POST("/ai/generate-ef-structure", {
				body: request,
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			return efStructureResponseToGeneratedDiagram(response.data);
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
		generateEFStructure,
		isLoading,
		error,
	};
};
