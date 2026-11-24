import { describe, expect, it } from "vitest";
import { MeasureQueryError } from "@/lib/measures/client";
import { loadNationPopulation } from "@/lib/measures/nationPopulation";
import { loadCouncilDensity } from "@/lib/measures/populationDensity";
import type {
	MeasureValuesPayload,
	MeasureValuesRequest,
} from "@/lib/measures/types";

const payload = (
	datasetId: string,
	period: string,
	values: Record<string, number>,
): MeasureValuesPayload => ({
	measure: {
		id: "population",
		label: "Population",
		description: "",
		valueKind: "count",
		unit: "people",
		aggregation: { kind: "extensive", available: true },
		dimensions: [],
	} as never,
	series: { id: "s", dimensions: {} },
	source: {
		datasetId,
		geography: "localAuthority",
		boundaryYear: 2023,
		periods: [period],
	},
	statuses: ["observed"],
	periods: [period],
	areas: Object.keys(values),
	columns: [
		{
			period,
			values: Object.values(values),
			status: Object.values(values).map(() => 0),
		},
	],
	extent: null,
	contentHash: "x",
});

const refuse = () => {
	throw new MeasureQueryError(404, "no_matching_series", "no");
};

const target = {
	geography: "localAuthority",
	boundaryYear: 2023,
	code: "S12000049",
};

describe("loadNationPopulation", () => {
	it("reads every age from the source that answers the first", async () => {
		const asked: Array<Omit<MeasureValuesRequest, "areas">> = [];
		const result = await loadNationPopulation(
			target,
			["0", "90-plus"],
			async (request) => {
				asked.push(request);
				const sex = request.dimensions?.sex?.[0];
				const age = request.dimensions?.age?.[0];
				if (!age) return refuse();
				const base = age === "0" ? 10 : 2;
				return payload("population-council-scotland", "2025", {
					S12000049: sex === "male" ? base : base + 1,
					S12000036: 999,
				});
			},
		);
		expect(result).toEqual({
			period: "2025",
			datasetId: "population-council-scotland",
			kind: "estimate",
			total: 26,
			males: 12,
			females: 14,
			ages: [
				{ age: 0, males: 10, females: 11 },
				{ age: 1, males: 2, females: 3 },
			],
		});
		expect(asked.slice(1).every((request) => request.datasetId)).toBe(true);
	});

	it("falls back to the sexes where no age is published", async () => {
		const result = await loadNationPopulation(
			{ geography: "dataZone", boundaryYear: 2022, code: "S01006506" },
			["0"],
			async (request) =>
				request.dimensions?.age
					? refuse()
					: payload("population-data-zone-scotland", "2024", {
							S01006506:
								request.dimensions?.sex?.[0] === "male"
									? 400
									: 420,
						}),
		);
		expect(result).toMatchObject({
			period: "2024",
			kind: "estimate",
			total: 820,
			males: 400,
			females: 420,
			ages: null,
		});
	});

	it("reads the council's total on any release where no sex is published", async () => {
		const asked: Array<Omit<MeasureValuesRequest, "areas">> = [];
		const result = await loadNationPopulation(
			target,
			["0"],
			async (request) => {
				asked.push(request);
				return request.dimensions
					? refuse()
					: payload("population-uk", "2024", {
							S12000049: 650_300,
							N09000003: 352_390,
						});
			},
		);
		expect(result).toEqual({
			period: "2024",
			datasetId: "population-uk",
			kind: "estimate",
			total: 650_300,
			males: null,
			females: null,
			ages: null,
		});
		expect(asked.at(-1)).toEqual({
			measure: "population",
			geography: "localAuthority",
		});
	});

	it("falls back to the census count, marked as a census", async () => {
		const result = await loadNationPopulation(
			{ geography: "dataZone", boundaryYear: 2021, code: "N20000001" },
			["0"],
			async (request) =>
				request.measure === "usual-residents"
					? payload("census-2021-ni-a01", "2021", { N20000001: 738 })
					: refuse(),
		);
		expect(result).toMatchObject({
			period: "2021",
			datasetId: "census-2021-ni-a01",
			kind: "census",
			total: 738,
			males: null,
		});
	});

	it("has no total where the code is not on the release", async () => {
		const result = await loadNationPopulation(
			target,
			[],
			async (request) =>
				request.measure === "population"
					? payload("population-uk", "2024", { S12000036: 1 })
					: refuse(),
		);
		expect(result.total).toBeNull();
	});

	it("has nothing where the route publishes nothing", async () => {
		const result = await loadNationPopulation(target, ["0"], async () =>
			refuse(),
		);
		expect(result.period).toBeNull();
		expect(result.males).toBeNull();
	});
});

describe("loadCouncilDensity", () => {
	it("reads a council's published density in the population's year", async () => {
		const asked: Array<Omit<MeasureValuesRequest, "areas">> = [];
		const density = await loadCouncilDensity(
			"S12000049",
			"2024",
			async (request) => {
				asked.push(request);
				return payload("population-uk", "2024", { S12000049: 3724 });
			},
		);
		expect(density).toEqual({
			perSqKm: 3724,
			period: "2024",
			datasetId: "population-uk",
		});
		expect(asked[0]).toEqual({
			measure: "population-density",
			geography: "localAuthority",
			periods: ["2024"],
		});
	});

	it("has none for another year or where the route refuses", async () => {
		expect(
			await loadCouncilDensity("S12000049", "2025", async () =>
				payload("population-uk", "2024", { S12000049: 3724 }),
			),
		).toBe(null);
		expect(
			await loadCouncilDensity("N09000003", "2024", async () => refuse()),
		).toBe(null);
	});
});
