export const fetchWithAuth = async (
	url: string,
	token: string | null | undefined,
	options: RequestInit = {},
) => {
	// Ajoute l'en-tête Authorization si un token est disponible
	const addAuthHeader = (headers: HeadersInit) => {
		if (token) {
			return {
				...headers,
				Authorization: `Bearer ${token}`,
			};
		}
		return headers;
	};

	const makeRequest = async () => {
		try {
			const response = await fetch(url, {
				...options,
				headers: addAuthHeader(options.headers || {}),
			});

			if (response.status === 401) {
				// Rafraîchit le token si nécessaire
				// To Code
				// if (refreshedToken) {
				//   // Refaire la requête avec le token rafraîchi
				//   return fetch(url, {
				//     ...options,
				//     headers: {
				//       ...addAuthHeader(options.headers || {}),
				//       Authorization: `Bearer ${refreshedToken}`,
				//     },
				//   });
				// }
			}

			return response;
		} catch (error) {
			console.error("Erreur dans fetchWithAuth :", error);
			throw error;
		}
	};

	if (!token) {
		console.warn("Aucun token disponible. Redirection possible.");
		throw new Error("Token manquant.");
	}

	return makeRequest();
};
