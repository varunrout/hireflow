/**
 * Secure API client for the extension.
 * Attaches auth tokens and handles refresh flow.
 */

import { getAccessToken, getApiUrl, setTokens } from "./storage";

export async function extensionFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiUrl = await getApiUrl();
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
