import { defineConfig, devices } from "@playwright/test";

// Config autonome (le paquet lovable-agent-playwright-config n'est pas installé).
// Le smoke test boote le build de prod via `vite preview`, servi sous la base "/".
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Sert le build de prod (dist/) — c'est ce que le code-splitting modifie réellement.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
