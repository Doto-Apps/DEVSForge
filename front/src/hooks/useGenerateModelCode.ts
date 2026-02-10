import { client } from "@/api/client";
import type {
	GenerateModelCodeRequest,
	GenerateModelCodeResult,
} from "@/types";
import { useState } from "react";

type UseGenerateModelCodeResult = {
	generateCode: (
		request: GenerateModelCodeRequest,
	) => Promise<GenerateModelCodeResult | null>;
	isLoading: boolean;
	error: string | null;
};

export const useGenerateModelCode = (): UseGenerateModelCodeResult => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateCode = async (
		request: GenerateModelCodeRequest,
	): Promise<GenerateModelCodeResult | null> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await client.POST("/ai/generate-model", {
				body: request,
			});

			if (!response.data) {
				throw new Error("No data received from API");
			}

			return response.data;
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
