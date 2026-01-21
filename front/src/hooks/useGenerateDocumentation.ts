import { client } from "@/api/client";
import { useState } from "react";

type GeneratedDocumentation = {
	description: string;
	keywords: string[];
	role: string;
};

type UseGenerateDocumentationResult = {
	generateDocumentation: (
		modelId: string,
	) => Promise<GeneratedDocumentation | null>;
	isLoading: boolean;
	error: string | null;
};

export const useGenerateDocumentation = (): UseGenerateDocumentationResult => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateDocumentation = async (
		modelId: string,
	): Promise<GeneratedDocumentation | null> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await client.POST("/ai/generate-documentation", {
				body: {
					modelId,
				},
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			return response.data as GeneratedDocumentation;
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
		generateDocumentation,
		isLoading,
		error,
	};
};
