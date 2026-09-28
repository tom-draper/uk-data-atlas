import { describe, expect, it } from "vitest";
import {
	aggregateIndicator,
	averageIndicator,
} from "@/lib/helpers/datasetAggregation/indicator";

const records = [
	{ code: "A", name: "Alpha", value: 10 },
	{ code: "B", name: "Bravo", value: 20 },
];

describe("indicator aggregation", () => {
	it("sums source totals", () => {
		expect(aggregateIndicator(records)).toEqual({ value: 30 });
	});

	it("averages local-area card values", () => {
		expect(averageIndicator(records)).toEqual({ value: 15 });
	});

	it("returns null when no areas have data", () => {
		expect(averageIndicator([])).toBeNull();
	});
});
