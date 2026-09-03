const { defineConfig, devices } = require("@playwright/test");
const { existsSync } = require("fs");

const operaPath = "C:\\Users\\Manu\\AppData\\Local\\Programs\\Opera\\opera.exe";
const desktopViewport = { width: 1440, height: 900 };
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";

module.exports = defineConfig({
  testDir: "./e2e",
  outputDir: "../output/playwright/night-runway-results",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: desktopViewport } },
    { name: "desktop-edge", use: { ...devices["Desktop Chrome"], channel: "msedge", viewport: desktopViewport } },
    ...(existsSync(operaPath) ? [{
      name: "desktop-opera",
      use: { ...devices["Desktop Chrome"], viewport: desktopViewport, launchOptions: { executablePath: operaPath } },
    }] : []),
    { name: "desktop-firefox", use: { browserName: "firefox", viewport: desktopViewport } },
    { name: "desktop-webkit", use: { browserName: "webkit", viewport: desktopViewport } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 14"] } },
    { name: "tablet-webkit", use: { ...devices["iPad Pro 11"] } },
  ],
  webServer: useExistingServer
    ? undefined
    : {
        command: "yarn serve:e2e",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
