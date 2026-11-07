import { useEffect, useState } from "react";
import { client } from "@/api/client";
import type { components } from "@/api/v1";

export type Integration = components["schemas"]["integrations.Definition"];
export const integrationKey = (d: Integration) => `${d.id}@${d.version}`;
export function useIntegrations() {
	const [data, setData] = useState<Integration[]>([]);
	const [error, setError] = useState<string>();
	useEffect(() => {
		let active = true;
		client
			.GET("/integrations")
			.then(({ data, error }) => {
				if (!active) return;
				if (error || !data) setError("Integration catalogue unavailable");
				else setData(data);
			})
			.catch((e) => {
				if (active) setError(String(e));
			});
		return () => {
			active = false;
		};
	}, []);
	return { data, error };
}
export async function fetchIntegrationTemplate(
	integration: Integration,
	name: string,
) {
	const { data, error } = await client.GET(
		"/integrations/{id}/versions/{version}/template",
		{
			params: {
				path: { id: integration.id ?? "", version: integration.version ?? "" },
				query: { name },
			},
		},
	);
	if (error || !data) throw new Error("Template unavailable");
	return data.code ?? "";
}
