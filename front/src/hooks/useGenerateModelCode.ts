import { client } from "@/api/client";
import type { components } from "@/api/v1";
import type { GenerateModelCodeResult, ReuseCandidate } from "@/types";
import { useState } from "react";

type GenerateModelCodeRequest =
	components["schemas"]["request.GenerateModelRequest"];
type APIGenerateModelCodeResult =
	components["schemas"]["response.GeneratedModelResponse"];
type APIReuseCandidate =
	components["schemas"]["response.ReuseCandidateResponse"];

const normalizeReuseCandidate = (
	candidate: APIReuseCandidate | undefined,
): ReuseCandidate | null => {
	if (!candidate?.modelId) return null;
	return {
		modelId: candidate.modelId,
		name: candidate.name ?? candidate.modelId,
		score: typeof candidate.score === "number" ? candidate.score : 0,
		keywords: candidate.keywords ?? [],
		description: candidate.description,
	};
};

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

			const data: APIGenerateModelCodeResult | undefined = response.data;
			if (!data) {
				throw new Error("No data received from API");
			}

			const normalizedCandidates = (data.reuseCandidates ?? [])
				.map((candidate) => normalizeReuseCandidate(candidate))
				.filter((candidate): candidate is ReuseCandidate => candidate !== null);
			const normalizedReuseUsed =
				normalizeReuseCandidate(data.reuseUsed) ?? undefined;

			return {
				code: data.code ?? "",
				keywords: data.keywords,
				reuseCandidates: normalizedCandidates,
				reuseUsed: normalizedReuseUsed,
				reuseMode: data.reuseMode,
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
		generateCode,
		isLoading,
		error,
	};
};
