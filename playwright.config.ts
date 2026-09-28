import { defineConfig } from "@playwright/test";

const launchOptions = process.env.CI
	? undefined
	: { executablePath: "/usr/bin/google-chrome" };

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 90_000,
	use: {
		baseURL: "http://localhost:3000",
		browserName: "chromium",
		launchOptions,
	},
	webServer: {
		command: "pnpm exec next dev --turbopack --port 3000",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
