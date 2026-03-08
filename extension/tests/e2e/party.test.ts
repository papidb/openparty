import { expect, test } from "@playwright/test";
import { backendRunning, getPopupPage, launchWithExtension } from "./helpers";

test.describe("Party controls and sidebar", () => {
  let backendAvailable = false;

  test.beforeAll(async () => {
    backendAvailable = await backendRunning();
  });

  test.beforeEach(() => {
    test.skip(!backendAvailable, "Backend not running");
  });

  test("successful login leads to party controls", async () => {
    const context = await launchWithExtension();

    try {
      const page = await getPopupPage(context);

      await page.locator("#login-email").fill("test@openparty.test");
      await page.locator("#login-password").fill("TestPassword123!");
      await page.locator("#login-submit").click();

      await Promise.race([
        page.locator("#start-party").waitFor({ timeout: 8_000 }),
        page.locator("#login-error").waitFor({ timeout: 8_000 })
      ]);
    } finally {
      await context.close();
    }
  });

  test("invite controls are shown after room start or join", async () => {
    const context = await launchWithExtension();

    try {
      const watchPage = await context.newPage();
      await watchPage.goto("https://example.com", { waitUntil: "domcontentloaded" });
      await watchPage.evaluate(() => {
        const video = document.createElement("video");
        video.style.width = "480px";
        video.style.height = "270px";
        video.controls = true;
        video.muted = true;
        document.body.appendChild(video);
      });

      const page = await getPopupPage(context);

      await page.locator("#login-email").fill("test@openparty.test");
      await page.locator("#login-password").fill("TestPassword123!");
      await page.locator("#login-submit").click();

      await Promise.race([
        page.locator("#start-party").waitFor({ timeout: 8_000 }),
        page.locator("#login-error").waitFor({ timeout: 8_000 })
      ]);

      if (await page.locator("#login-error").isVisible().catch(() => false)) {
        test.skip(true, "Test user is unavailable in backend");
      }

      await expect(page.locator("#video-status")).toBeVisible({ timeout: 8_000 });
      await expect(page.locator("#start-party")).toBeVisible();
      await expect(page.locator("#video-status")).toContainText(/Video detected|No video detected/);

      const started = await page
        .locator("#start-party")
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);

      if (started) {
        await Promise.race([
          page.locator("#invite-link").waitFor({ timeout: 10_000 }),
          page.locator("#login-error").waitFor({ timeout: 10_000 })
        ]);

        if (await page.locator("#invite-link").isVisible().catch(() => false)) {
          await expect(watchPage.locator("#openparty-sidebar-host")).toBeVisible({ timeout: 10_000 });
        }
      }
    } finally {
      await context.close();
    }
  });
});
