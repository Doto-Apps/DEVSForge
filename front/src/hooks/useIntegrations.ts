import { client, useImmutable } from "@/api/client";
import type { components } from "@/api/v1";

export type Integration = components["schemas"]["integrations.Definition"];
export const integrationKey = (d: Integration) => `${d.id}@${d.version}`;
const emptyIntegrations: Integration[] = [];
export function useIntegrations() {
	const { data, error } = useImmutable("/integrations");
	return {
		data: data ?? emptyIntegrations,
		error: error ? "Integration catalogue unavailable" : undefined,
	};
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
