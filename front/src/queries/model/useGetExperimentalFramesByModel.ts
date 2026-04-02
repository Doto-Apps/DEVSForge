import type { TypesForRequest } from "swr-openapi";
import { useQuery } from "@/api/client";
import type { paths } from "@/api/v1";

const path: keyof paths = "/experimental-frame/model/{modelId}";

type GetRequestType = TypesForRequest<paths, "get", typeof path>;

export const useGetExperimentalFramesByModel = (
	params: GetRequestType["Init"] | null,
	config: GetRequestType["SWRConfig"] = {},
) => useQuery(path, params, config);
