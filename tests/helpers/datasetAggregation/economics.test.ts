import { describe, expect, it } from "vitest";
import { aggregateCustomDataset } from "@/lib/helpers/datasetAggregation/economics";
import {
	aggregateCrime,
	aggregateJobs,
	aggregateNHSWaiting,
} from "@uk-data-atlas/datasets";
import { CODE_KEY, features } from "./fixtures";

describe("aggregateJobs", () => {
	it("sums workplace jobs across the covered local authorities", () => {
		expect(
			aggregateJobs([
				{ ladCode: "E1", ladName: "One", totalJobs: 120_000 },
				{ ladCode: "E2", ladName: "Two", totalJobs: 80_000 },
			]),
		).toEqual({ totalJobs: 200_000 });
	});

	it("returns null where no local authorities are covered", () => {
		expect(aggregateJobs([])).toBeNull();
	});
});

describe("aggregateCustomDataset", () => {
	it("counts and averages the covered values", () => {
		const result = aggregateCustomDataset(
			features(["E1", "E2", "missing"]),
			CODE_KEY,
			{ E1: 1, E2: 4 },
		);
		expect(result).toEqual({ count: 2, average: 2.5 });
	});

	it("keeps a zero value in the average", () => {
		expect(
			aggregateCustomDataset(features(["E1", "E2"]), CODE_KEY, {
				E1: 0,
				E2: 10,
			}),
		).toEqual({ count: 2, average: 5 });
	});

	it("reports zero when nothing is covered", () => {
		expect(
			aggregateCustomDataset(features(["missing"]), CODE_KEY, {}),
		).toEqual({
			count: 0,
			average: 0,
		});
	});
});

describe("aggregateCrime", () => {
	it("averages recorded crime over the covered areas", () => {
		expect(
			aggregateCrime([
				{ totalRecordedCrime: 100 },
				{ totalRecordedCrime: 300 },
			] as any),
		).toEqual({ totalRecordedCrime: 200 });
	});

	it("reports nothing when no covered area has a record", () => {
		expect(aggregateCrime([])).toBeNull();
	});
});

describe("aggregateNHSWaiting", () => {
	it("sums the boards and recomputes the share from the totals", () => {
		expect(
			aggregateNHSWaiting([
				{ total: 100, over18Weeks: 40 },
				{ total: 300, over18Weeks: 60 },
			] as any),
		).toEqual({ total: 400, over18Weeks: 100, pctOver18Weeks: 25 });
	});

	it("reports nothing when there are no waiting pathways", () => {
		expect(aggregateNHSWaiting([])).toBeNull();
		expect(
			aggregateNHSWaiting([{ total: 0, over18Weeks: 0 }] as any),
		).toBeNull();
	});
});
