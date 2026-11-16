import { useQuery } from "@/api/client";

export function useModelCapabilities(id?: string) {
	const { data, error } = useQuery(
		"/model/{id}/capabilities",
		id ? { params: { path: { id } } } : null,
	);
	return {
		available: data?.simulation === true && !error,
		reason: error
			? "Execution availability could not be checked."
			: data?.reason || "Checking execution availability…",
	};
}
