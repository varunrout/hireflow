/**
 * Token storage utilities for the extension.
 * Uses chrome.storage.local (encrypted by Chrome profile) instead of localStorage.
 */

const TOKEN_KEY = "hireflow_access_token";
const REFRESH_KEY = "hireflow_refresh_token";
const API_URL_KEY = "hireflow_api_url";

const DEFAULT_API_URL = "https://hireflow-j68z.onrender.com";

export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return (result[TOKEN_KEY] as string) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(REFRESH_KEY);
  return (result[REFRESH_KEY] as string) ?? null;
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]: accessToken,
    [REFRESH_KEY]: refreshToken,
  });
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, REFRESH_KEY]);
}

export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get(API_URL_KEY);
  return (result[API_URL_KEY] as string) ?? DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [API_URL_KEY]: url });
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
