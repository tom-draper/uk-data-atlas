import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("withCDN", () => {
	it("uses local paths outside production", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const { withCDN } = await import("@/lib/helpers/cdn");

		expect(withCDN("/data/precompiled/population.json")).toBe(
			"/data/precompiled/population.json",
		);
	});

	it("pins production data to the release version", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const { withCDN } = await import("@/lib/helpers/cdn");

		expect(withCDN("/data/precompiled/population.json")).toBe(
			"https://cdn.jsdelivr.net/gh/tom-draper/uk-data-atlas@v0.1.7/data/precompiled/population.json",
		);
	});

	it("uses an injected release version when one is available", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_DATA_VERSION", "v0.1.8");
		const { withCDN } = await import("@/lib/helpers/cdn");

		expect(withCDN("/data/precompiled/population.json")).toBe(
			"https://cdn.jsdelivr.net/gh/tom-draper/uk-data-atlas@v0.1.8/data/precompiled/population.json",
		);
	});
});
