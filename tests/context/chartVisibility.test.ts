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
		"shows only the curated default cards",
		async () => {
			const { DEFAULT_VISIBILITY } =
				await import("@/lib/context/ChartVisibilityContext");
			const { DEFAULT_CHART_KEYS } =
				await import("@/lib/datasets/chartSections");
			const shown = Object.keys(DEFAULT_VISIBILITY).filter(
				(key) => DEFAULT_VISIBILITY[key],
			);
			expect(shown.sort()).toEqual([...DEFAULT_CHART_KEYS].sort());
			for (const year of [2016, 2017, 2018, 2019, 2021]) {
				expect(DEFAULT_VISIBILITY[`localElection-${year}`]).toBe(false);
			}
			expect(DEFAULT_VISIBILITY["localElection-2025"]).toBe(true);
			expect(DEFAULT_VISIBILITY["housing-net-additional-dwellings"]).toBe(
				false,
			);
			expect(
				DEFAULT_VISIBILITY["health-adult-social-care-outcomes"],
			).toBe(false);
			expect(DEFAULT_VISIBILITY["economy-local-government-finance"]).toBe(
				false,
			);
		},
		COLD_IMPORT_TIMEOUT,
	);

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
