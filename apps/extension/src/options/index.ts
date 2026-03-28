import { getApiUrl, setApiUrl, getWebUrl, setWebUrl } from "../shared/storage";

async function init(): Promise<void> {
  const apiUrlInput = document.getElementById("api-url") as HTMLInputElement;
  const webUrlInput = document.getElementById("web-url") as HTMLInputElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
  const status = document.getElementById("status")!;

  // Load saved URLs
  const [savedApi, savedWeb] = await Promise.all([getApiUrl(), getWebUrl()]);
  apiUrlInput.value = savedApi;
  webUrlInput.value = savedWeb;

  saveBtn.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, "");
    const webUrl = webUrlInput.value.trim().replace(/\/$/, "");
    if (!apiUrl || !webUrl) return;

    await Promise.all([setApiUrl(apiUrl), setWebUrl(webUrl)]);

    status.classList.add("visible");
    setTimeout(() => status.classList.remove("visible"), 2000);
  });
}

init().catch(console.error);
