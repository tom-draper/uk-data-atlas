import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	isNumericObservation,
	observationsFor,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	queryMeasureValues,
	type MeasureValues,
	type MeasureValuesColumn,
	type MeasureValuesProblem,
	type MeasureValuesRequest,
} from "@uk-data-atlas/atlas-runtime/measures";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";
import { createMeasureFixture } from "../helpers/measureFixture";

let fixture: ReturnType<typeof createMeasureFixture>;

beforeAll(() => {
	fixture = createMeasureFixture();
}, 120_000);

afterAll(() => closeAllReadOnlyDatabases());

const ask = (request: MeasureValuesRequest) =>
	queryMeasureValues(fixture.context, request);

const values = (request: MeasureValuesRequest): MeasureValues => {
	const result = ask(request);
	if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
	return result;
};

const problem = (request: MeasureValuesRequest): MeasureValuesProblem => {
	const result = ask(request);
	if (result.ok) throw new Error("Expected a problem");
	return result;
};

const column = (result: MeasureValues, period: string) =>
	result.columns.find(
		(candidate) => candidate.period === period,
	) as MeasureValuesColumn;

describe("measure values", () => {
	it("returns the latest period for every area with the render metadata", () => {
		const result = values({ measure: "population" });
		expect(result.periods).toEqual(["2023"]);
		expect(result.areas).toEqual([
			"E06000001",
			"E06000002",
			"E06000003",
			"E06000004",
		]);
		expect(column(result, "2023").values).toEqual([110, 290, 620, 50]);
		expect(result.measure).toMatchObject({
			id: "population",
			valueKind: "count",
			unit: "people",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			dimensions: [],
		});
		expect(result.source).toEqual({
			datasetId: "population-fixture",
			geography: "localAuthority",
			boundaryYear: 2023,
			periods: ["2022", "2023"],
		});
		expect(result.extent).toEqual({ min: 50, max: 620 });
	});

	it("matches the observation artifact value for value", () => {
		const result = values({
			measure: "population",
			periods: ["2022", "2023"],
		});
		const source = fixture.catalog.measures[0]!.sources[0]!;
		for (const period of result.periods) {
			const records = observationsFor("population", source, period, {
				measureObservations: fixture.context.measureObservations,
			})!.records.filter(isNumericObservation);
			const expected = new Map(
				records.map((record) => [record.areaCode, record.value]),
			);
			const held = column(result, period);
			result.areas.forEach((code, index) =>
				expect(held.values[index]).toBe(expected.get(code) ?? null),
			);
		}
	});

	it("returns several periods in the order asked and null where an area has no value", () => {
		const result = values({
			measure: "population",
			periods: ["2023", "2022"],
		});
		expect(result.periods).toEqual(["2023", "2022"]);
		const past = column(result, "2022");
		expect(past.values).toEqual([100, 300, 600, null]);
		expect(result.statuses[past.status[3]!]).toBe("missing");
		expect(result.statuses[past.status[0]!]).toBe("observed");
	});

	it("carries the publisher's status", () => {
		const result = values({ measure: "population" });
		const latest = column(result, "2023");
		expect(result.statuses[latest.status[3]!]).toBe("derived");
	});

	it("keeps only the areas asked for, in that order", () => {
		const result = values({
			measure: "population",
			areas: ["E06000003", "E99999999", "E06000001"],
		});
		expect(result.areas).toEqual(["E06000003", "E99999999", "E06000001"]);
		const held = column(result, "2023");
		expect(held.values).toEqual([620, null, 110]);
		expect(result.statuses[held.status[1]!]).toBe("missing");
	});

	it("refuses a period the source does not publish", () => {
		const refused = problem({ measure: "population", periods: ["1999"] });
		expect(refused).toMatchObject({ status: 404, code: "unknown_period" });
		expect(refused.detail).toContain("2022, 2023");
	});

	it("refuses an unknown measure", () => {
		expect(problem({ measure: "nothing" })).toMatchObject({
			status: 404,
			code: "unknown_measure",
		});
	});

	it("refuses a geography the measure is not published on", () => {
		expect(
			problem({ measure: "population", geography: "ward" }),
		).toMatchObject({ status: 404, code: "no_matching_source" });
	});

	it("reads the publisher's interval where the measure declares one", () => {
		const result = values({ measure: "claim-rate" });
		const held = column(result, "2023");
		expect(held.values).toEqual([4.2, 5.1, 3.3]);
		expect(held.lower).toEqual([3.9, 4.6, null]);
		expect(held.upper).toEqual([4.5, 5.6, null]);
		expect(result.measure.uncertainty?.level).toBe(0.95);
	});
});

describe("measure values and dimensions", () => {
	it("takes the total for a dimension left out", () => {
		const result = values({ measure: "households" });
		expect(result.series).toEqual({
			id: "households-total",
			dimensions: { tenure: "total" },
		});
		expect(column(result, "2021").values).toEqual([40, 120]);
	});

	it("reads the member a filter names", () => {
		const result = values({
			measure: "households",
			dimensions: { tenure: ["rented"] },
		});
		expect(result.series.id).toBe("households-rented");
		expect(column(result, "2021").values).toEqual([15, 50]);
		expect(result.measure.dimensions).toEqual([
			{
				id: "tenure",
				label: "Tenure",
				total: "total",
				members: [
					{ code: "total", label: "All households" },
					{ code: "owned", label: "Owned", parent: "total" },
					{ code: "rented", label: "Rented", parent: "total" },
				],
			},
		]);
	});

	it("reads a catalogue series id as its measure and members", () => {
		const result = values({ measure: "households-owned" });
		expect(result.measure.id).toBe("households");
		expect(column(result, "2021").values).toEqual([25, 70]);
	});

	it("refuses a series id filtered off its own member", () => {
		expect(
			problem({
				measure: "households-owned",
				dimensions: { tenure: ["rented"] },
			}),
		).toMatchObject({ status: 400, code: "unknown_dimension_member" });
	});

	it("refuses a filter that leaves more than one series", () => {
		const refused = problem({
			measure: "households",
			dimensions: { tenure: ["*"] },
		});
		expect(refused).toMatchObject({
			status: 409,
			code: "ambiguous_series",
		});
		expect(refused.choices).toHaveLength(3);
	});

	it("refuses an unknown dimension and an unknown member", () => {
		expect(
			problem({ measure: "households", dimensions: { colour: ["red"] } }),
		).toMatchObject({ status: 400, code: "unknown_dimension" });
		const member = problem({
			measure: "households",
			dimensions: { tenure: ["squatting"] },
		});
		expect(member).toMatchObject({
			status: 400,
			code: "unknown_dimension_member",
		});
		expect(member.choices).toHaveLength(3);
		expect(
			problem({
				measure: "population",
				dimensions: { tenure: ["owned"] },
			}).detail,
		).toContain("no dimensions");
	});
});

describe("measure values combined over areas", () => {
	const parents = [
		{ code: "P1", memberCodes: ["E06000001", "E06000002", "E06000003"] },
		{ code: "P2", memberCodes: ["E06000004", "E06000099"] },
		{ code: "P3", memberCodes: ["E06000099"] },
	];

	it("sums an extensive measure and marks a parent with a missing member partial", () => {
		const result = values({ measure: "population", parents });
		expect(result.areas).toEqual(["P1", "P2", "P3"]);
		const held = column(result, "2023");
		expect(held.values).toEqual([1020, 50, null]);
		expect(held.status.map((index) => result.statuses[index])).toEqual([
			"aggregated",
			"partial",
			"missing",
		]);
		expect(result.combined).toEqual({
			operation: "sum",
			parents: 3,
			partial: 1,
		});
	});

	it("takes a mean weighted by the measure's declared weight", () => {
		const result = values({
			measure: "access-rate",
			parents: [{ code: "P1", memberCodes: ["E06000001", "E06000002"] }],
		});
		// (50 * 110 + 100 * 290) / 400
		expect(column(result, "2023").values[0]).toBeCloseTo(86.25, 10);
		expect(result.combined?.operation).toBe("weighted-mean");
	});

	it("takes no mean where an area has a value but no weight", () => {
		// E06000005 has an access rate but no population to weight it by.
		const result = values({
			measure: "access-rate",
			parents: [{ code: "P1", memberCodes: ["E06000001", "E06000005"] }],
		});
		const held = column(result, "2023");
		expect(held.values).toEqual([null]);
		expect(result.statuses[held.status[0]!]).toBe("partial");
		expect(result.combined?.partial).toBe(1);
	});

	it("refuses a measure that declares itself not aggregatable", () => {
		const refused = problem({ measure: "median-age", parents });
		expect(refused).toMatchObject({
			status: 422,
			code: "aggregation_not_supported",
		});
		expect(refused.detail).toContain("a median");
		expect(refused.detail).toContain("median of medians");
	});

	it("restricts the parents to those asked for", () => {
		const result = values({
			measure: "population",
			parents,
			areas: ["P2"],
		});
		expect(result.areas).toEqual(["P2"]);
	});
});
