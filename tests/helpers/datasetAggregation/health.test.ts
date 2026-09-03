import { describe, expect, it } from "vitest";
import { aggregateNHSWaiting } from "@/lib/helpers/datasetAggregation/health";
import { CODE_KEY, features } from "./fixtures";

const dataset = {
	ladToIcb: { E1: "ICB1", E2: "ICB1", E3: "ICB2" },
	data: {
		ICB1: { total: 1000, over18Weeks: 400 },
		ICB2: { total: 3000, over18Weeks: 600 },
	},
} as any;

describe("aggregateNHSWaiting", () => {
	it("counts each ICB once however many LADs reach it", () => {
		const result = aggregateNHSWaiting(features(["E1", "E2", "E3"]), CODE_KEY, dataset);

		expect(result).toEqual({ total: 4000, over18Weeks: 1000, pctOver18Weeks: 25 });
	});

	it("ignores LADs with no ICB mapping or no waiting record", () => {
		const unmapped = { ...dataset, ladToIcb: { ...dataset.ladToIcb, E4: "ICB3" } };
		const result = aggregateNHSWaiting(features(["E1", "E4", "missing"]), CODE_KEY, unmapped);

		expect(result).toEqual({ total: 1000, over18Weeks: 400, pctOver18Weeks: 40 });
	});

	it("returns null when no covered LAD reaches an ICB", () => {
		expect(aggregateNHSWaiting(features(["missing"]), CODE_KEY, dataset)).toBeNull();
	});
});
