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
				visibility({ "health-nhs-waiting": true }),
			),
		).toBe(true);
		expect(
			hasVisibleChart(
				"Health",
				visibility({ "health-nhs-waiting": false }),
			),
		).toBe(false);
	});

	it("puts the primary economics cards first", () => {
		const charts = getVisibleChartDefinitions(
			"Economics",
			visibility({
				"economics-housePrice": true,
				"economics-income": true,
				"economics-regionalGdpItl3": true,
				"economics-jobs": true,
				"economics-planningApplications": true,
				"economics-council-tax": true,
				"economics-unemployment": true,
				"economics-child-poverty": true,
				"economics-fuelPoverty": true,
				"economics-business-activity": true,
			}),
		);

		expect(charts.map(({ chart }) => chart.key)).toEqual([
			"economics-housePrice",
			"economics-income",
			"economics-regionalGdpItl3",
			"economics-jobs",
			"economics-planningApplications",
			"economics-council-tax",
			"economics-unemployment",
			"economics-child-poverty",
			"economics-fuelPoverty",
			"economics-business-activity",
		]);
	});
});
