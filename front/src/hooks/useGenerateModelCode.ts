import { client } from "@/api/client";
import type { GenerateModelCodeRequest } from "@/types";
import { useState } from "react";

type UseGenerateModelCodeResult = {
	generateCode: (request: GenerateModelCodeRequest) => Promise<string | null>;
	isLoading: boolean;
	error: string | null;
};

export const useGenerateModelCode = (): UseGenerateModelCodeResult => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateCode = async (
		request: GenerateModelCodeRequest,
	): Promise<string | null> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await client.POST("/ai/generate-model", {
				body: {
					modelName: request.modelName,
					language: request.language,
					ports: request.ports,
					previousModelsCode: request.previousModelsCode,
					userPrompt: request.userPrompt,
				},
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			return response.data.code;
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
		generateCode,
		isLoading,
		error,
	};
};
