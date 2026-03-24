import { client } from "@/api/client";
import type { components } from "@/api/v1";
import { useState } from "react";

type GenerateDocumentationRequest =
	components["schemas"]["request.GenerateDocumentationRequest"];
type GeneratedDocumentationResponse =
	components["schemas"]["response.GeneratedDocumentationResponse"];

export type GeneratedDocumentation = {
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
			const payload: GenerateDocumentationRequest = {
				modelId,
			};

			const response = await client.POST("/ai/generate-documentation", {
				body: payload,
			});

			const data: GeneratedDocumentationResponse | undefined = response.data;
			if (!data) {
				throw new Error("No data received from API");
			}

			return {
				description: data.description ?? "",
				keywords: data.keywords ?? [],
				role: data.role ?? "",
			};
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
