import { getApiUrl } from "../shared/storage";

const STORAGE_KEY = "hireflow_api_url";
const DEFAULT_URL = "https://hireflow-j68z.onrender.com";

async function init(): Promise<void> {
  const apiUrlInput = document.getElementById("api-url") as HTMLInputElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
  const status = document.getElementById("status")!;

  // Load saved URL
  const saved = await getApiUrl();
  apiUrlInput.value = saved || DEFAULT_URL;

  saveBtn.addEventListener("click", async () => {
    const url = apiUrlInput.value.trim().replace(/\/$/, "");
    if (!url) return;

    await chrome.storage.local.set({ [STORAGE_KEY]: url });

    status.classList.add("visible");
    setTimeout(() => status.classList.remove("visible"), 2000);
  });
}

init().catch(console.error);
