import { useEffect, useState } from "react";
import { client } from "@/api/client";
import type { components } from "@/api/v1";

// Types from OpenAPI
export type LanguageInfo = components["schemas"]["response.LanguageInfo"];
export type LanguagesResponse =
	components["schemas"]["response.LanguageListResponse"];
export type TemplateResponse =
	components["schemas"]["response.LanguageTemplateResponse"];

/**
 * Hook to fetch the list of available programming languages for DEVS models
 */
export function useGetLanguages() {
	const [data, setData] = useState<LanguagesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchLanguages = async () => {
			try {
				setIsLoading(true);
				const response = await client.GET("/languages");
				if (!response.data) {
					throw new Error("Failed to fetch languages");
				}
				setData(response.data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setIsLoading(false);
			}
		};

		fetchLanguages();
	}, []);

	return { data, error, isLoading };
}

/**
 * Function to fetch template directly (not a hook)
 * Useful for one-time fetches in form submissions
 */
export async function fetchLanguageTemplate(
	language: string,
	modelName: string,
): Promise<string> {
	const response = await client.GET("/languages/{lang}/template", {
		params: {
			path: { lang: language },
			query: { name: modelName },
		},
	});
	if (!response.data) {
		throw new Error("Failed to fetch language template");
	}
	return response.data.code ?? "";
}
