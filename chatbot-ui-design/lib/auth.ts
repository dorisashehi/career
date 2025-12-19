// Simple utility functions to store and retrieve the admin token
// We use localStorage so the token persists across page refreshes

const TOKEN_KEY = "admin_access_token";

// Save the token to localStorage
export function saveAdminToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

// Get the token from localStorage
export function getAdminToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

// Remove the token (for logout)
export function removeAdminToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Check if admin is logged in
export function isAdminLoggedIn(): boolean {
  return getAdminToken() !== null;
}
