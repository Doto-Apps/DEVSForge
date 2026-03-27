import type { paths } from "@/api/v1";
import { isMatch } from "lodash-es";
import createClient, { type Middleware } from "openapi-fetch";
import {
	createImmutableHook,
	createInfiniteHook,
	createMutateHook,
	createQueryHook,
} from "swr-openapi";

const API_BASE_URL = window.API_URL;
const prefix = "my-api";

const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const REFRESH_SKEW_SECONDS = 30;

const AUTH_TOKEN_REFRESHED_EVENT = "auth:access-token-refreshed";
const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

const AUTH_BYPASS_PATHS = new Set([
	"/auth/login",
	"/auth/register",
	"/auth/refresh",
]);

export const client = createClient<paths>({
	baseUrl: API_BASE_URL,
});

const getAccessToken = (): string | null =>
	localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

const clearStoredTokens = () => {
	localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
	localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
};

const dispatchTokenRefreshed = (accessToken: string) => {
	window.dispatchEvent(
		new CustomEvent<string>(AUTH_TOKEN_REFRESHED_EVENT, {
			detail: accessToken,
		}),
	);
};

const dispatchSessionExpired = () => {
	window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
};

const buildApiUrl = (path: string) => {
	const trimmedBaseUrl = API_BASE_URL.replace(/\/+$/, "");
	return `${trimmedBaseUrl}${path}`;
};

const isBypassPath = (request: Request) => {
	const { pathname } = new URL(request.url, window.location.origin);
	return AUTH_BYPASS_PATHS.has(pathname);
};

type JwtPayload = {
	exp?: number;
};

const parseJwtPayload = (token: string): JwtPayload | null => {
	const tokenParts = token.split(".");
	if (tokenParts.length !== 3) {
		return null;
	}

	try {
		const payload = tokenParts[1];
		const normalizedPayload = payload
			.replace(/-/g, "+")
			.replace(/_/g, "/")
			.padEnd(Math.ceil(payload.length / 4) * 4, "=");
		return JSON.parse(atob(normalizedPayload)) as JwtPayload;
	} catch {
		return null;
	}
};

const isTokenExpiringSoon = (
	token: string,
	skewSeconds = REFRESH_SKEW_SECONDS,
) => {
	const payload = parseJwtPayload(token);
	if (!payload?.exp) {
		return true;
	}

	const nowInSeconds = Math.floor(Date.now() / 1000);
	return payload.exp <= nowInSeconds + skewSeconds;
};

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
	if (refreshPromise) {
		return refreshPromise;
	}

	refreshPromise = (async () => {
		const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
		if (!refreshToken) {
			clearStoredTokens();
			dispatchSessionExpired();
			return null;
		}

		try {
			const response = await fetch(buildApiUrl("/auth/refresh"), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ refreshToken }),
			});

			if (!response.ok) {
				clearStoredTokens();
				dispatchSessionExpired();
				return null;
			}

			const data = (await response.json()) as { accessToken?: string };
			if (!data.accessToken) {
				clearStoredTokens();
				dispatchSessionExpired();
				return null;
			}

			localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.accessToken);
			dispatchTokenRefreshed(data.accessToken);
			return data.accessToken;
		} catch {
			clearStoredTokens();
			dispatchSessionExpired();
			return null;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
};

const getTokenForRequest = async (request: Request): Promise<string | null> => {
	const token = getAccessToken();
	if (!token || isBypassPath(request)) {
		return token;
	}

	if (!isTokenExpiringSoon(token)) {
		return token;
	}

	return refreshAccessToken();
};

const myMiddleware: Middleware = {
	async onRequest({ request }) {
		const token = await getTokenForRequest(request);
		if (token) {
			request.headers.set("Authorization", `Bearer ${token}`);
		}
		return request;
	},
	async onResponse({ request, response }) {
		if (!response.ok) {
			console.error(`API Error: ${response.status} ${response.statusText}`);
		}

		if (response.status === 401 && !isBypassPath(request)) {
			clearStoredTokens();
			dispatchSessionExpired();
		}

		return response;
	},
	async onError({ error }) {
		console.error("Fetch Error:", error);
		return new Error(String(error));
	},
};

client.use(myMiddleware);

export const useQuery = createQueryHook(client, prefix);
export const useImmutable = createImmutableHook(client, prefix);
export const useInfinite = createInfiniteHook(client, prefix);
export const useMutate = createMutateHook(client, prefix, isMatch);
