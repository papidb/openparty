import { BrowserContext, chromium } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const EXTENSION_PATH = path.resolve(currentDir, "../../.output/chrome-mv3");
export const API_BASE = "http://localhost:4000";

export async function launchWithExtension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "openparty-pw-"));

  return chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
      "--disable-dev-shm-usage"
    ]
  });
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const existingWorkers = context.serviceWorkers();

  if (existingWorkers.length === 0) {
    await context.waitForEvent("serviceworker", { timeout: 30_000 });
  }

  const worker = context.serviceWorkers()[0];
  if (!worker) {
    throw new Error("Extension service worker was not detected.");
  }

  return worker.url().split("/")[2] ?? "";
}

export async function getPopupPage(context: BrowserContext) {
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
  return page;
}

export async function backendRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
