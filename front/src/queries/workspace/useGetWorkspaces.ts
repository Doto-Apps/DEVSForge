import { useQuery } from "@/api/client";
import type { paths } from "@/api/v1";
import type { TypesForRequest } from "swr-openapi";

const path: keyof paths = "/workspace";

type GetRequestType = TypesForRequest<paths, "get", typeof path>;

export const useGetWorkspaces = (
	params: GetRequestType["Init"] | null = undefined,
	config: GetRequestType["SWRConfig"] = {},
) => useQuery(path, params, config);
