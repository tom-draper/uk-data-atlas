import { describe, expect, it } from "vitest";
import { joinPeriods, olderPeriodChunks } from "@/lib/measures/history";
import { MAX_PERIODS } from "@/lib/measures/request";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const answer = (
	sourcePeriods: string[],
	areas: string[],
	statuses: string[],
	columns: Array<{
		period: string;
		values: Array<number | null>;
		status: number[];
	}>,
): MeasureValuesPayload =>
	({
		measure: { id: "m", label: "M", valueKind: "count", unit: "people" },
		series: { id: "m", dimensions: {} },
		source: {
			datasetId: "d",
			geography: "localAuthority",
			boundaryYear: 2023,
			periods: sourcePeriods,
		},
		statuses,
		periods: columns.map((column) => column.period),
		areas,
		columns,
		extent: null,
		contentHash: "x",
	}) as unknown as MeasureValuesPayload;

const months = (count: number) =>
	Array.from(
		{ length: count },
		(_, index) => `p${String(index).padStart(3, "0")}`,
	);

describe("olderPeriodChunks", () => {
	it("asks for nothing more when the answer holds every period", () => {
		const periods = months(12);
		expect(
			olderPeriodChunks(
				answer(
					periods,
					[],
					[],
					periods.map((period) => ({
						period,
						values: [],
						status: [],
					})),
				),
			),
		).toEqual([]);
	});

	it("splits the periods left out into requests the route accepts", () => {
		const periods = months(166);
		const latest = periods.slice(-MAX_PERIODS);
		const chunks = olderPeriodChunks(
			answer(
				periods,
				[],
				[],
				latest.map((period) => ({ period, values: [], status: [] })),
			),
		);
		expect(chunks.map((chunk) => chunk.length)).toEqual([40, 40, 40, 6]);
		expect(chunks.flat()).toEqual(periods.slice(0, -MAX_PERIODS));
	});
});

describe("joinPeriods", () => {
	it("joins answers over every area either holds, in the source's period order", () => {
		const source = ["2012", "2013", "2014"];
		const older = answer(
			source,
			["A", "OLD"],
			["observed", "missing"],
			[{ period: "2012", values: [1, 2], status: [0, 0] }],
		);
		const latest = answer(
			source,
			["A", "B"],
			["observed", "missing", "estimated"],
			[
				{ period: "2013", values: [3, null], status: [0, 1] },
				{ period: "2014", values: [4, 5], status: [0, 2] },
			],
		);
		const joined = joinPeriods([latest, older]);
		expect(joined.areas).toEqual(["A", "B", "OLD"]);
		expect(joined.periods).toEqual(source);
		expect(joined.statuses).toEqual(["observed", "missing", "estimated"]);
		expect(joined.columns).toEqual([
			{ period: "2012", values: [1, null, 2], status: [0, 1, 0] },
			{ period: "2013", values: [3, null, null], status: [0, 1, 1] },
			{ period: "2014", values: [4, 5, null], status: [0, 2, 1] },
		]);
	});

	it("returns a single answer as it is", () => {
		const only = answer(
			["2012"],
			["A"],
			["observed"],
			[{ period: "2012", values: [1], status: [0] }],
		);
		expect(joinPeriods([only])).toBe(only);
	});
});
