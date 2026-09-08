import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("chart visibility store", () => {
	it("reads localStorage once, then serves the in-memory snapshot", async () => {
		const getItem = vi.fn(() => JSON.stringify({ population: false }));
		vi.stubGlobal("localStorage", { getItem });

		const { getVisibilitySnapshot } =
			await import("@/lib/context/ChartVisibilityContext");
		expect(getVisibilitySnapshot().population).toBe(false);
		expect(getVisibilitySnapshot().population).toBe(false);
		expect(getItem).toHaveBeenCalledTimes(1);
	});
});
