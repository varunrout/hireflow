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
    btn.textContent = "⚡ Loading...";
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
        btn.textContent = "⚡ Error - Try again";
        btn.disabled = false;
        console.error("[HireFlow] Autofill error:", response.error);
        return;
      }

      // TODO: Show review modal before applying
      btn.textContent = "⚡ HireFlow Autofill";
      btn.disabled = false;
      console.log("[HireFlow] Autofill suggestions:", response.data);
    });
  });

  document.body.appendChild(btn);
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
