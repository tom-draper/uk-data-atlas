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

	it("versions production data with the deployment version", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const { withCDN } = await import("@/lib/helpers/cdn");

		expect(withCDN("/data/precompiled/population.json")).toBe(
			"/data/precompiled/population.json?v=v0.1.8",
		);
	});

	it("uses an injected release version when one is available", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_DATA_VERSION", "v0.1.8");
		const { withCDN } = await import("@/lib/helpers/cdn");

		expect(withCDN("/data/precompiled/population.json")).toBe(
			"/data/precompiled/population.json?v=v0.1.8",
		);
	});

	it("preserves an existing query string", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_DATA_VERSION", "abc123");
		const { withCDN } = await import("@/lib/helpers/cdn");

		expect(withCDN("/data/boundaries.json?level=ward")).toBe(
			"/data/boundaries.json?level=ward&v=abc123",
		);
	});
});
