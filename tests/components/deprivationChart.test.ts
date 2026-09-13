import { describe, expect, it } from "vitest";
import {
	areaDisplay,
	summaryDisplay,
	type DeprivationIndex,
} from "@/components/deprivation/DeprivationChart";

const index: DeprivationIndex = {
	datasetType: "imd",
	label: "IMD",
	region: "England",
	attribution: "",
	metric: "rank",
	metricMaximum: 100,
	areaNoun: "LSOAs",
};

describe("areaDisplay", () => {
	it("labels the most deprived tenth as decile 1, as published", () => {
		const display = areaDisplay(index, 1, { kind: "rank", value: 1 });
		expect(display.secondary).toBe("Decile 1");
		// The most deprived rank still fills the bar and colours it red.
		expect(display.barWidth).toBe(100);
	});

	it("labels the least deprived tenth as decile 10", () => {
		expect(
			areaDisplay(index, 10, { kind: "rank", value: 100 }).secondary,
		).toBe("Decile 10");
	});

	it("shows a rank with no decile line where none is published", () => {
		const display = areaDisplay(index, null, { kind: "rank", value: 42 });
		expect(display.hasData).toBe(true);
		expect(display.value).toBe("42");
		expect(display.secondary).toBeUndefined();
	});
});

describe("summaryDisplay", () => {
	it("puts the national rate of a tenth at the middle of the scale", () => {
		const display = summaryDisplay(
			{ areaCount: 200, mostDeprivedCount: 20 },
			"LSOAs",
		);
		expect(display.value).toBe("10%");
		expect(display.secondary).toBe("20 of 200 LSOAs");
		expect(display.severity).toBe(0.5);
	});

	it("saturates at twice the national rate", () => {
		expect(
			summaryDisplay({ areaCount: 10, mostDeprivedCount: 5 }, "LSOAs")
				.severity,
		).toBe(1);
	});
});
