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
		expect(hasVisibleChart("Health", visibility({ "health-nhsWaiting": true }))).toBe(true);
		expect(hasVisibleChart("Health", visibility({ "health-nhsWaiting": false }))).toBe(false);
	});
});
