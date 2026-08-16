import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * The browser suite. It runs against the production build served by `vite
 * preview`, not against the dev server, so a broken base path — the site is
 * served from a subdirectory on GitHub Pages — fails here rather than on deploy.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/malom/`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/malom/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
