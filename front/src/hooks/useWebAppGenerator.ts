import { client } from "@/api/client";
import type { components } from "@/api/v1";
import { useState } from "react";

type WebAppSkeletonResponse =
	components["schemas"]["response.WebAppSkeletonResponse"];
type GenerateWebAppRequest =
	components["schemas"]["request.GenerateWebAppRequest"];
type CreateWebAppDeploymentRequest =
	components["schemas"]["request.CreateWebAppDeploymentRequest"];
type WebAppDeploymentResponse =
	components["schemas"]["response.WebAppDeploymentResponse"];

type UseWebAppGeneratorResult = {
	isLoading: boolean;
	error: string | null;
	generateSkeleton: (modelId: string) => Promise<WebAppSkeletonResponse | null>;
	refineWithAI: (
		request: GenerateWebAppRequest,
	) => Promise<WebAppSkeletonResponse | null>;
	createDeployment: (
		request: CreateWebAppDeploymentRequest,
	) => Promise<WebAppDeploymentResponse | null>;
};

export const useWebAppGenerator = (): UseWebAppGeneratorResult => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateSkeleton = async (
		modelId: string,
	): Promise<WebAppSkeletonResponse | null> => {
		setIsLoading(true);
		setError(null);
		try {
			const { data, error: apiError } = await client.POST(
				"/webapp/skeleton/{modelId}",
				{
					params: {
						path: {
							modelId,
						},
					},
				},
			);

			if (apiError || !data) {
				throw new Error("Failed to generate skeleton");
			}

			return data;
		} catch (err) {
			const message = err instanceof Error ? err.message : "An error occurred";
			setError(message);
			return null;
		} finally {
			setIsLoading(false);
		}
	};

	const refineWithAI = async (
		request: GenerateWebAppRequest,
	): Promise<WebAppSkeletonResponse | null> => {
		setIsLoading(true);
		setError(null);
		try {
			const { data, error: apiError } = await client.POST("/webapp/generate", {
				body: request,
			});

			if (apiError || !data) {
				throw new Error("Failed to refine WebApp schema");
			}

			return data;
		} catch (err) {
			const message = err instanceof Error ? err.message : "An error occurred";
			setError(message);
			return null;
		} finally {
			setIsLoading(false);
		}
	};

	const createDeployment = async (
		request: CreateWebAppDeploymentRequest,
	): Promise<WebAppDeploymentResponse | null> => {
		setIsLoading(true);
		setError(null);
		try {
			const { data, error: apiError } = await client.POST(
				"/webapp/deployment",
				{
					body: request,
				},
			);

			if (apiError || !data) {
				throw new Error("Failed to create WebApp deployment");
			}

			return data;
		} catch (err) {
			const message = err instanceof Error ? err.message : "An error occurred";
			setError(message);
			return null;
		} finally {
			setIsLoading(false);
		}
	};

	return {
		isLoading,
		error,
		generateSkeleton,
		refineWithAI,
		createDeployment,
	};
};
