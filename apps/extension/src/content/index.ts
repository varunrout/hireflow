/**
 * Content script - injected into job application pages.
 * Detects form fields and communicates with background worker.
 */

import type { DetectedField, ExtensionMessage, ExtensionResponse } from "../shared/messages";

let formObserver: MutationObserver | null = null;

function detectPlatform(): string {
  const { hostname } = window.location;
  if (hostname.includes("linkedin")) return "linkedin";
  if (hostname.includes("greenhouse")) return "greenhouse";
  if (hostname.includes("lever")) return "lever";
  if (hostname.includes("workday")) return "workday";
  if (hostname.includes("indeed")) return "indeed";
  return "unknown";
}

function detectFormFields(): DetectedField[] {
  const fields: DetectedField[] = [];
  const formElements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select"
  );

  formElements.forEach((el) => {
    const label = findLabel(el);
    fields.push({
      id: el.id || el.name || `field-${fields.length}`,
      name: el.name || el.id || "",
      label,
      type: el.tagName.toLowerCase() === "textarea" ? "textarea" : (el as HTMLInputElement).type || "text",
      placeholder: (el as HTMLInputElement).placeholder || undefined,
      required: el.required,
      currentValue: el.value || undefined,
    });
  });

  return fields;
}

function findLabel(el: Element): string {
  // Try aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // Try associated label element
  const id = el.getAttribute("id");
  if (id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() ?? "";
  }

  // Try parent label
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.textContent?.trim() ?? "";

  // Try placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return placeholder;

  return el.getAttribute("name") ?? "";
}

function injectHireFlowButton(): void {
  if (document.getElementById("hireflow-btn")) return;

  const fields = detectFormFields();
  if (fields.length === 0) return;

  const btn = document.createElement("button");
  btn.id = "hireflow-btn";
  btn.textContent = "⚡ HireFlow Autofill";
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
    background: #1e40af;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: background 0.2s;
  `;

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#1d4ed8";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#1e40af";
  });

  btn.addEventListener("click", async () => {
    btn.textContent = "⚡ Filling...";
    btn.disabled = true;

    const message: ExtensionMessage = {
      type: "GET_AUTOFILL_SUGGESTIONS",
      payload: {
        jobUrl: window.location.href,
        formFields: fields,
      },
      requestId: crypto.randomUUID(),
    };

    chrome.runtime.sendMessage(message, (response: ExtensionResponse) => {
      if (!response.success) {
        btn.textContent = "⚡ Error – try again";
        btn.disabled = false;
        console.error("[HireFlow] Autofill error:", response.error);
        showToast("❌ Autofill failed: " + response.error, "error");
        return;
      }

      const data = response.data as {
        suggestions: Array<{ field_id: string; suggested_value: string; confidence: number }>;
        fields_filled: number;
        fields_detected: number;
      };

      const filled = applyFieldSuggestions(data.suggestions);

      // Record the application in HireFlow
      chrome.runtime.sendMessage(
        {
          type: "CREATE_APPLICATION",
          payload: { job_posting_id: null, source: "extension", notes: `Auto-applied via extension on ${window.location.hostname}` },
          requestId: crypto.randomUUID(),
        } satisfies ExtensionMessage,
        () => {} // fire-and-forget
      );

      showToast(`✅ Filled ${filled} fields · Saved to HireFlow`, "success");
      btn.textContent = "✅ Filled!";
      setTimeout(() => {
        btn.textContent = "⚡ HireFlow Autofill";
        btn.disabled = false;
      }, 3000);

      console.log("[HireFlow] Autofill complete:", data);
    });
  });

  document.body.appendChild(btn);
}

/**
 * Write suggestion values into the real DOM inputs and fire synthetic events
 * so React/Vue/Angular controlled forms pick up the changes.
 */
function applyFieldSuggestions(
  suggestions: Array<{ field_id: string; suggested_value: string }>
): number {
  let filled = 0;

  for (const suggestion of suggestions) {
    const el = (
      document.getElementById(suggestion.field_id) ??
      document.querySelector<HTMLElement>(`[name="${suggestion.field_id}"]`)
    ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

    if (!el || el.disabled || el.readOnly) continue;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, suggestion.suggested_value);
    } else {
      (el as HTMLInputElement).value = suggestion.suggested_value;
    }

    // Fire events so controlled component frameworks register the change
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    filled++;
  }

  return filled;
}

/**
 * Inject a small toast notification in the bottom-left corner.
 */
function showToast(message: string, type: "success" | "error"): void {
  const existing = document.getElementById("hireflow-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "hireflow-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 99999;
    background: ${type === "success" ? "#166534" : "#991b1b"};
    color: white;
    border-radius: 8px;
    padding: 12px 18px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    line-height: 1.4;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Initialize
function init(): void {
  const platform = detectPlatform();
  console.log(`[HireFlow] Initialized on ${platform}`);

  // Inject button when form is detected
  injectHireFlowButton();

  // Watch for dynamic form additions (SPAs)
  formObserver = new MutationObserver(() => {
    injectHireFlowButton();
  });

  formObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
