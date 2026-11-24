import { describe, expect, it } from "vitest";
import { MeasureQueryError } from "@/lib/measures/client";
import { loadNationPopulation } from "@/lib/measures/nationPopulation";
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
			males: 400,
			females: 420,
			ages: null,
		});
	});

	it("has nothing where the route publishes nothing", async () => {
		const result = await loadNationPopulation(target, ["0"], async () =>
			refuse(),
		);
		expect(result.period).toBeNull();
		expect(result.males).toBeNull();
	});
});
