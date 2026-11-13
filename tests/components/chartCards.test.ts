import {
	getVisibleChartDefinitions,
	hasVisibleChart,
} from "@/components/ChartCards";
import type { ChartKey } from "@/lib/context/ChartVisibilityContext";

const visibility = (enabled: Partial<Record<ChartKey, boolean>>) =>
	enabled as Record<ChartKey, boolean>;

describe("ChartCards registry selection", () => {
	it("returns only visible charts in the requested theme", () => {
		const charts = getVisibleChartDefinitions(
			"economy",
			visibility({
				"economy-income": true,
				"economy-jobs": false,
				"economics-housePrice": true,
			}),
		);

		expect(charts).toHaveLength(1);
		expect(charts[0].chart.key).toBe("economy-income");
	});

	it("reports whether a theme contains a visible chart", () => {
		expect(
			hasVisibleChart(
				"health",
				visibility({ "health-nhs-waiting": true }),
			),
		).toBe(true);
		expect(
			hasVisibleChart(
				"health",
				visibility({ "health-nhs-waiting": false }),
			),
		).toBe(false);
	});

	it("splits the old Economics group across themes", () => {
		const all = visibility({
			"economics-housePrice": true,
			"economy-income": true,
			"society-child-poverty": true,
			"society-crime": true,
		});

		expect(
			getVisibleChartDefinitions("economy", all).map(
				({ chart }) => chart.key,
			),
		).toEqual(["economy-income"]);
		expect(
			getVisibleChartDefinitions("housing", all).map(
				({ chart }) => chart.key,
			),
		).toEqual(["economics-housePrice"]);
		expect(
			getVisibleChartDefinitions("society", all).map(
				({ chart }) => chart.key,
			),
		).toEqual(["society-child-poverty", "society-crime"]);
	});

	it("orders cards by topic, then by registry order", () => {
		const charts = getVisibleChartDefinitions(
			"economy",
			visibility({
				"economy-regional-gdp-itl3": true,
				"economy-jobs": true,
				"economy-income": true,
				"economy-business-activity": true,
			}),
		);

		expect(charts.map(({ chart }) => chart.topic)).toEqual([
			"labour-market",
			"earnings-and-income",
			"business",
			"economic-output",
		]);
	});
});
