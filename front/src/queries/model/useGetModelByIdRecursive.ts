import { useQuery } from "@/api/client";
import type { paths } from "@/api/v1";
import type { TypesForRequest } from "swr-openapi";

const path: keyof paths = "/model/{id}/recursive";

type GetRequestType = TypesForRequest<paths, "get", typeof path>;

export const useGetModelByIdRecursive = (
	params: GetRequestType["Init"] | null,
	config: GetRequestType["SWRConfig"] = {},
) => useQuery(path, params, config);
