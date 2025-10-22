export const API_BASE =
    process.env.NODE_ENV === "production"
        ? process.env.REACT_APP_API
        : "http://localhost:4004";

export async function apiFetch(endpoint, options = {}) {
    return fetch(`${API_BASE}${endpoint}`, {
        credentials: "include",
        ...options,
    });
}
