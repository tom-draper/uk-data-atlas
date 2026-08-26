import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 90_000,
	use: {
		baseURL: "http://localhost:3000",
		browserName: "chromium",
		launchOptions: { executablePath: "/usr/bin/google-chrome" },
	},
	webServer: {
		command: "pnpm exec next dev --turbopack --port 3000",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
