import type { components, paths } from "@/api/v1";
import { useToast } from "@/hooks/use-toast";
import createClient from "openapi-fetch";
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useState,
} from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextProps {
	user: components["schemas"]["response.UserResponse"] | null;
	token: string | null | undefined;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, password: string) => Promise<void>;
	logout: () => void;
	refreshAccessToken: () => Promise<string | null>;
	isAuthenticated: boolean;
	isInitialized: boolean;
	isLoading: boolean;
}

const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const AUTH_TOKEN_REFRESHED_EVENT = "auth:access-token-refreshed";
const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const apiClient = createClient<paths>({
	baseUrl: import.meta.env.VITE_API_BASE_URL,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<
		components["schemas"]["response.UserResponse"] | null
	>(null);
	const [token, setToken] = useState<string | null | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(true);
	const navigate = useNavigate();
	const { toast } = useToast();

	const clearSessionState = () => {
		setToken(null);
		setUser(null);
		localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
		localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
	};

	const refreshAccessToken = async (): Promise<string | null> => {
		const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
		if (!refreshToken) {
			clearSessionState();
			return null;
		}

		try {
			const { data, error } = await apiClient.POST("/auth/refresh", {
				body: { refreshToken },
			});

			if (error || !data?.accessToken) {
				console.error("Failed to refresh access token", error);
				clearSessionState();
				return null;
			}

			setToken(data.accessToken);
			localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.accessToken);
			return data.accessToken;
		} catch (error) {
			console.error("Error refreshing access token", error);
			clearSessionState();
			return null;
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const handleTokenRefreshed = (event: Event) => {
			const tokenRefreshEvent = event as CustomEvent<string>;
			if (tokenRefreshEvent.detail) {
				setToken(tokenRefreshEvent.detail);
			}
		};

		const handleSessionExpired = () => {
			clearSessionState();
			if (window.location.pathname !== "/login") {
				navigate("/login");
			}
		};

		window.addEventListener(
			AUTH_TOKEN_REFRESHED_EVENT,
			handleTokenRefreshed as EventListener,
		);
		window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);

		return () => {
			window.removeEventListener(
				AUTH_TOKEN_REFRESHED_EVENT,
				handleTokenRefreshed as EventListener,
			);
			window.removeEventListener(
				AUTH_SESSION_EXPIRED_EVENT,
				handleSessionExpired,
			);
		};
	}, [navigate]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const initializeAuth = async () => {
			const fetchCurrentUser = async (accessToken: string) => {
				const { data, error } = await apiClient.GET("/auth/me", {
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				});

				if (error || !data) {
					return null;
				}

				return data;
			};

			try {
				const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
				if (!storedToken) {
					setToken(null);
					return;
				}

				setToken(storedToken);

				let currentUser = await fetchCurrentUser(storedToken);
				if (!currentUser) {
					const refreshedToken = await refreshAccessToken();
					if (refreshedToken) {
						currentUser = await fetchCurrentUser(refreshedToken);
					}
				}

				if (!currentUser) {
					clearSessionState();
					return;
				}

				setUser(currentUser);
			} catch (error) {
				console.error("Authentication initialization failed", error);
				clearSessionState();
			} finally {
				setIsLoading(false);
			}
		};

		initializeAuth();
	}, []);

	const login = async (email: string, password: string) => {
		try {
			const { data, error } = await apiClient.POST("/auth/login", {
				body: { identity: email, password },
			});

			if (error) {
				console.error("Login error", error);
				toast({
					description: "An error occurred while logging in.",
					variant: "destructive",
				});
				throw new Error("Invalid credentials.");
			}

			if (data?.accessToken && data?.refreshToken) {
				setToken(data.accessToken);
				setUser({ username: data.username, email: data.email });
				localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.accessToken);
				localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
			}
		} catch (error) {
			console.error("Login failed", error);
			throw error;
		}
	};

	const register = async (email: string, password: string) => {
		try {
			const { error } = await apiClient.POST("/auth/register", {
				body: { email, password, username: email.split("@")[0] },
			});

			if (error) {
				console.error("Register error", error);
				throw new Error("This user already exists.");
			}

			navigate("/login");
		} catch (error) {
			console.error("Register failed", error);
			throw error;
		}
	};

	const logout = async () => {
		try {
			const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
			if (refreshToken) {
				await apiClient.POST("/auth/logout", {
					body: { refreshToken },
				});
			}
		} catch (error) {
			console.error("Logout error", error);
		} finally {
			clearSessionState();
			navigate("/login");
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				isInitialized: token !== undefined,
				isAuthenticated: !!token,
				isLoading,
				login,
				register,
				logout,
				refreshAccessToken,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
