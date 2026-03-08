import { expect, test } from "@playwright/test";
import { getPopupPage, launchWithExtension } from "./helpers";

test.describe("Popup login flow", () => {
  test("shows login form on initial open", async () => {
    const context = await launchWithExtension();

    try {
      const page = await getPopupPage(context);

      await expect(page.locator("#login-form")).toBeVisible();
      await expect(page.locator("#login-email")).toBeVisible();
      await expect(page.locator("#login-password")).toBeVisible();
      await expect(page.locator("#login-submit")).toBeVisible();
      await expect(page.locator("#register-link")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("renders login error for invalid credentials", async () => {
    const context = await launchWithExtension();

    try {
      const page = await getPopupPage(context);

      await page.locator("#login-email").fill("bad@example.com");
      await page.locator("#login-password").fill("wrongpassword");
      await page.locator("#login-submit").click();

      await expect(page.locator("#login-error")).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
