import type { components, paths } from "@/api/v1"; // Import des types générés par OpenAPI
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

// Définition du contexte d'authentification
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

// Création du contexte
const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// Création du client API
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

	// Fonction pour rafraîchir le token
	const refreshAccessToken = async (): Promise<string | null> => {
		try {
			const { data, error } = await apiClient.POST("/auth/refresh", {
				body: {
					refreshToken: localStorage.getItem("refreshToken") ?? "",
				},
			});

			if (error) {
				console.error("Erreur de rafraîchissement du token :", error);
				logout();
				return null;
			}

			if (data?.accessToken) {
				setToken(data.accessToken);
				localStorage.setItem("accessToken", data.accessToken);
				return data.accessToken;
			}

			return null;
		} catch (error) {
			console.error("Error refreshing token:", error);
			logout();
			return null;
		}
	};

	useEffect(() => {
		const initializeAuth = async () => {
			try {
				const storedToken = localStorage.getItem("accessToken");

				if (!storedToken) {
					setIsLoading(false);
					setToken(null);
					return;
				}

				setToken(storedToken);

				// Récupérer les infos utilisateur avec le token
				const { data, error } = await apiClient.GET("/auth/me", {
					headers: {
						Authorization: `Bearer ${storedToken}`,
					},
				});

				if (error) {
					console.error("Erreur de récupération de l'utilisateur :", error);
					setToken(null);
					localStorage.removeItem("accessToken");
					return;
				}

				setUser(data ?? null);
			} catch (error) {
				console.error("Erreur d'initialisation de l'authentification :", error);
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
				console.error("Erreur de connexion :", error);
				toast({
					description:
						String(error) || "An error occurred while generating the diagram.",
					variant: "destructive",
				});
				throw new Error("Identifiants incorrects.");
			}

			if (data?.accessToken && data?.refreshToken) {
				setToken(data.accessToken);
				setUser({ username: data.username, email: data.email });

				localStorage.setItem("accessToken", data.accessToken);
				localStorage.setItem("refreshToken", data.refreshToken);
			}
		} catch (error) {
			console.error("Erreur lors de la connexion :", error);
			throw error;
		}
	};

	const register = async (email: string, password: string) => {
		try {
			const { error } = await apiClient.POST("/auth/register", {
				body: { email, password, username: email.split("@")[0] }, // Exemple de username basé sur l'email
			});

			if (error) {
				console.error("Erreur lors de l'inscription :", error);
				throw new Error("Cet utilisateur existe déjà.");
			}

			navigate("/login");
		} catch (error) {
			console.error("Erreur d'inscription :", error);
			throw error;
		}
	};

	const logout = async () => {
		try {
			const refreshToken = localStorage.getItem("refreshToken");

			if (refreshToken) {
				await apiClient.POST("/auth/logout", {
					body: { refreshToken },
				});
			}
		} catch (error) {
			console.error("Erreur lors de la déconnexion :", error);
		} finally {
			setToken(null);
			setUser(null);
			localStorage.removeItem("accessToken");
			localStorage.removeItem("refreshToken");
			navigate("/login"); // Redirige vers la page de connexion après logout
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

// Hook pour accéder au contexte
export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
