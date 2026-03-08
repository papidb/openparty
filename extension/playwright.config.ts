import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000
  },
  projects: [
    {
      name: "chrome-extension"
    }
  ]
});
