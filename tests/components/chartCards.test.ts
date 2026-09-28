import {
	getVisibleChartDefinitions,
	hasVisibleChart,
} from "@/components/ChartCards";
import type { ChartKey } from "@/lib/context/ChartVisibilityContext";

const visibility = (enabled: Partial<Record<ChartKey, boolean>>) =>
	enabled as Record<ChartKey, boolean>;

describe("ChartCards registry selection", () => {
	it("returns only visible charts in the requested group", () => {
		const charts = getVisibleChartDefinitions(
			"Economics",
			visibility({
				"economics-housePrice": true,
				"economics-income": false,
				"economics-crime": false,
			}),
		);

		expect(charts).toHaveLength(1);
		expect(charts[0].chart.key).toBe("economics-housePrice");
	});

	it("reports whether a group contains a visible chart", () => {
		expect(
			hasVisibleChart(
				"Health",
				visibility({ "health-nhsWaiting": true }),
			),
		).toBe(true);
		expect(
			hasVisibleChart(
				"Health",
				visibility({ "health-nhsWaiting": false }),
			),
		).toBe(false);
	});

	it("puts the primary economics cards first", () => {
		const charts = getVisibleChartDefinitions(
			"Economics",
			visibility({
				"economics-housePrice": true,
				"economics-income": true,
				"economics-planningApplications": true,
				"economics-councilTax": true,
				"economics-unemployment": true,
				"economics-childPoverty": true,
				"economics-fuelPoverty": true,
				"economics-businessActivity": true,
			}),
		);

		expect(charts.map(({ chart }) => chart.key)).toEqual([
			"economics-housePrice",
			"economics-income",
			"economics-planningApplications",
			"economics-councilTax",
			"economics-unemployment",
			"economics-childPoverty",
			"economics-fuelPoverty",
			"economics-businessActivity",
		]);
	});
});
