import { afterEach, describe, expect, it, vi } from "vitest";

// Each test imports the chart registry afresh, which loads every dataset
// definition and its chart component: over a second on its own, and several
// seconds when the whole suite runs in parallel.
const COLD_IMPORT_TIMEOUT = 20_000;

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("chart visibility store", () => {
	it(
		"includes source text for every settings entry",
		async () => {
			const { CHART_CONFIG } =
				await import("@/lib/context/ChartVisibilityContext");
			expect(CHART_CONFIG).not.toHaveLength(0);
			for (const chart of CHART_CONFIG) expect(chart.source).not.toBe("");
		},
		COLD_IMPORT_TIMEOUT,
	);

	it(
		"reads localStorage once, then serves the in-memory snapshot",
		async () => {
			const getItem = vi.fn(() => JSON.stringify({ population: false }));
			vi.stubGlobal("localStorage", { getItem });

			const { getVisibilitySnapshot } =
				await import("@/lib/context/ChartVisibilityContext");
			expect(getVisibilitySnapshot().population).toBe(false);
			expect(getVisibilitySnapshot().population).toBe(false);
			expect(getItem).toHaveBeenCalledTimes(1);
		},
		COLD_IMPORT_TIMEOUT,
	);
});
