/**
 * Background service worker.
 * Handles messages from content scripts and popup.
 * Manages auth state and API calls.
 */

import type { ExtensionMessage, ExtensionResponse } from "../shared/messages";
import { clearTokens, isAuthenticated } from "../shared/storage";
import { extensionFetch } from "../shared/api-client";

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          requestId: message.requestId,
        })
      );

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case "AUTH_CHECK": {
      const authenticated = await isAuthenticated();
      return { success: true, data: { authenticated } };
    }

    case "AUTH_LOGOUT": {
      await clearTokens();
      return { success: true };
    }

    case "GET_PROFILE": {
      const profile = await extensionFetch("/profiles/me");
      return { success: true, data: profile };
    }

    case "GET_AUTOFILL_SUGGESTIONS": {
      const { jobUrl, formFields } = message.payload as {
        jobUrl: string;
        formFields: unknown[];
      };
      const suggestions = await extensionFetch("/autofill/suggest", {
        method: "POST",
        body: JSON.stringify({ job_url: jobUrl, fields: formFields }),
      });
      return { success: true, data: suggestions };
    }

    case "CREATE_APPLICATION": {
      const application = await extensionFetch("/applications", {
        method: "POST",
        body: JSON.stringify({
          ...(message.payload as object),
          source: "extension",
        }),
      });
      return { success: true, data: application };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// Alarm for token refresh (every 45 minutes)
chrome.alarms.create("token-refresh", { periodInMinutes: 45 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "token-refresh") {
    refreshTokenIfNeeded().catch(console.error);
  }
});

async function refreshTokenIfNeeded(): Promise<void> {
  const { getRefreshToken, setTokens } = await import("../shared/storage");
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;

  try {
    const apiUrl = await (await import("../shared/storage")).getApiUrl();
    const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      await setTokens(data.access_token, data.refresh_token);
    }
  } catch {
    // Silent fail - user will be prompted to re-authenticate
  }
}
