import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { EXTENSION_PATH, getPopupPage, launchWithExtension } from "./helpers";

test.describe("Error states", () => {
  test("popup renders without critical console errors", async () => {
    const context = await launchWithExtension();

    try {
      const page = await getPopupPage(context);
      const errors: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#login-form")).toBeVisible({ timeout: 5_000 });

      const criticalErrors = errors.filter((entry) => !entry.includes("favicon") && !entry.includes("net::ERR"));
      expect(criticalErrors).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  test("manifest stays valid for MV3", async () => {
    const manifestPath = path.join(EXTENSION_PATH, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      manifest_version: number;
      name: string;
      permissions?: string[];
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("OpenParty");
    expect(manifest.permissions ?? []).toContain("storage");
    expect(manifest.permissions ?? []).toContain("activeTab");
  });

  test("shows an error for invalid credentials", async () => {
    const context = await launchWithExtension();

    try {
      const page = await getPopupPage(context);

      await page.locator("#login-email").fill("bad@example.com");
      await page.locator("#login-password").fill("wrongpassword");
      await page.locator("#login-submit").click();

      await page.locator("#login-error").waitFor({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
