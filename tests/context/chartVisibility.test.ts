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
		"hides the 2016 to 2019 local election cards by default",
		async () => {
			const { DEFAULT_VISIBILITY } =
				await import("@/lib/context/ChartVisibilityContext");
			for (const year of [2016, 2017, 2018, 2019]) {
				expect(DEFAULT_VISIBILITY[`localElection-${year}`]).toBe(false);
			}
			expect(DEFAULT_VISIBILITY["localElection-2021"]).toBe(true);
			expect(DEFAULT_VISIBILITY["economics-netAdditionalDwellings"]).toBe(
				false,
			);
			expect(DEFAULT_VISIBILITY["health-adultSocialCareOutcomes"]).toBe(
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
