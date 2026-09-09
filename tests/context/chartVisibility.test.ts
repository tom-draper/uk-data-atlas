import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("chart visibility store", () => {
	it("includes source text for every settings entry", async () => {
		const { CHART_CONFIG } =
			await import("@/lib/context/ChartVisibilityContext");
		expect(CHART_CONFIG).not.toHaveLength(0);
		for (const chart of CHART_CONFIG) expect(chart.source).not.toBe("");
	});

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
