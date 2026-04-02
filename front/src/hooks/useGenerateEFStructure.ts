import { useState } from "react";
import { client } from "@/api/client";
import { efStructureResponseToGeneratedDiagram } from "@/lib/llmToReactFlow";
import type {
	GeneratedDiagram,
	GenerateEFStructureRequest,
} from "@/types/generator";

type UseGenerateEFStructureResult = {
	generateEFStructure: (
		request: GenerateEFStructureRequest,
	) => Promise<GeneratedDiagram | null>;
	isLoading: boolean;
	error: string | null;
};

const extractApiErrorMessage = (apiError: unknown): string | null => {
	if (!apiError || typeof apiError !== "object") return null;
	const payload = apiError as Record<string, unknown>;

	const directMessageKeys = ["error", "message", "detail"] as const;
	for (const key of directMessageKeys) {
		const value = payload[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	for (const value of Object.values(payload)) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	return null;
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
			const { data, error: apiError } = await client.POST(
				"/ai/generate-ef-structure",
				{
					body: request,
				},
			);

			if (apiError || !data) {
				throw new Error(
					extractApiErrorMessage(apiError) ?? "No data received from API",
				);
			}

			return efStructureResponseToGeneratedDiagram(data);
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
		error,
		generateEFStructure,
		isLoading,
	};
};
