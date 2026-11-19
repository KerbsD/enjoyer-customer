import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3103",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3103",
    env: { NEXT_PUBLIC_API_URL: "http://localhost:4000" },
    url: "http://localhost:3103",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
