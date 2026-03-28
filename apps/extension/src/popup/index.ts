import { getApiUrl, isAuthenticated, clearTokens } from "../shared/storage";

const SUPPORTED_PLATFORMS: Record<string, string> = {
  linkedin: "LinkedIn",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  indeed: "Indeed",
};

function detectPlatform(url: string): string {
  for (const key of Object.keys(SUPPORTED_PLATFORMS)) {
    if (url.includes(key)) return key;
  }
  return "unknown";
}

async function init(): Promise<void> {
  const loading = document.getElementById("loading")!;
  const main = document.getElementById("main")!;

  const [authenticated, apiUrl] = await Promise.all([
    isAuthenticated(),
    getApiUrl(),
  ]);

  // Auth status
  const authDot = document.getElementById("auth-dot")!;
  const authLabel = document.getElementById("auth-label")!;
  const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

  if (authenticated) {
    authDot.classList.add("green");
    authLabel.textContent = "Signed in";
    logoutBtn.style.display = "block";
  } else {
    authDot.classList.add("red");
    authLabel.textContent = "Not signed in — open HireFlow to log in";
  }

  // Current tab platform detection
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const platform = detectPlatform(url);

  const pageDot = document.getElementById("page-dot")!;
  const pageLabel = document.getElementById("page-label")!;
  const platformBadge = document.getElementById("platform-badge")!;

  if (platform !== "unknown") {
    pageDot.classList.add("green");
    pageLabel.textContent = "Supported job site";
    platformBadge.textContent = SUPPORTED_PLATFORMS[platform]!;
  } else {
    pageDot.classList.add("yellow");
    pageLabel.textContent = "Not a supported job page";
    platformBadge.textContent = "Unsupported";
    platformBadge.classList.add("unsupported");
  }

  // Open app link
  const openApp = document.getElementById("open-app") as HTMLAnchorElement;
  // Use the web app URL (strip /api prefix from API URL)
  const webUrl = apiUrl.replace(/\/api.*$/, "").replace("localhost:8000", "localhost:3000");
  openApp.href = webUrl || "https://hireflow.vercel.app";

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await clearTokens();
    logoutBtn.style.display = "none";
    authDot.className = "dot red";
    authLabel.textContent = "Signed out";
  });

  loading.style.display = "none";
  main.style.display = "block";
}

init().catch(console.error);
