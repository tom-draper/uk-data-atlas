import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { declaredDisplay } from "@/lib/datasets/declared";
import type { MapOptions } from "@/lib/types/mapOptions";

const definitionOf = (type: string) =>
	CHART_DATASET_DEFINITIONS.find((candidate) => candidate.type === type)!;

const imdOptions = (measure: string): MapOptions =>
	({
		...DEFAULT_MAP_OPTIONS,
		imd: { ...DEFAULT_MAP_OPTIONS.imd, measure },
	}) as MapOptions;

const imdRecord = {
	imdScore: 42.5,
	incomeScore: 0.123,
	employmentScore: 0.0987,
	educationScore: 30,
	healthScore: -1.2,
	crimeScore: 0.5,
	housingScore: 25,
	livingEnvironmentScore: 40,
};
const imdDataset = { type: "imd", data: { E1: imdRecord } } as never;

describe("imd map measures", () => {
	const { map } = definitionOf("imd");

	it("lists the overall score first, then each domain", () => {
		expect(declaredDisplay("imd")!.measures.map(({ id }) => id)).toEqual([
			"imdScore",
			"incomeScore",
			"employmentScore",
			"educationScore",
			"healthScore",
			"crimeScore",
			"housingScore",
			"livingEnvironmentScore",
		]);
	});

	it("reads the chosen measure from the record", () => {
		for (const [measure, value] of Object.entries(imdRecord))
			expect(map!.valueFor!(imdDataset, "E1", imdOptions(measure))).toBe(
				value,
			);
		expect(map!.valueFor!(imdDataset, "missing", DEFAULT_MAP_OPTIONS)).toBe(
			null,
		);
	});

	it("starts the overall score at 1 to 70 and each domain on its full range", () => {
		expect(DEFAULT_MAP_OPTIONS.imd.colorRange).toEqual({ min: 1, max: 70 });
		const ranges = Object.fromEntries(
			declaredDisplay("imd")!.measures.map((measure) => [
				measure.id,
				measure.legend,
			]),
		);
		expect(ranges.incomeScore).toMatchObject({ min: 0, max: 0.6 });
		expect(ranges.healthScore).toMatchObject({ min: -3, max: 3 });
		expect(ranges.crimeScore).toMatchObject({ min: -3, max: 3 });
		expect(ranges.educationScore).toMatchObject({ min: 0, max: 100 });
	});

	it("words income and employment to three places and the rest to one", () => {
		const { format, bounds } = map!.legend;
		expect(format(0.1234, imdOptions("incomeScore"))).toBe("0.123");
		expect(format(0.1234, imdOptions("employmentScore"))).toBe("0.123");
		expect(format(42.56, imdOptions("imdScore"))).toBe("42.6");
		expect(bounds!(imdOptions("healthScore"))).toEqual({ min: -3, max: 3 });
	});

	it("keeps each measure's source apart", () => {
		expect(map!.sourceMode!(imdDataset, imdOptions("crimeScore"))).toBe(
			"imd:crimeScore",
		);
	});
});

describe.each([
	["wimd", 1909],
	["simd", 6976],
	["nimdm", 890],
])("%s rank map", (type, count) => {
	const { map } = definitionOf(type);
	const options = DEFAULT_MAP_OPTIONS;

	it("reads the rank and keeps low ranks at the low end of the scale", () => {
		const dataset = {
			type,
			data: { A: { [`${type}Rank`]: 12 } },
		} as never;
		expect(map!.valueFor!(dataset, "A", options)).toBe(12);
		expect(map!.invertColor).toBe(false);
		expect(map!.colorRange).toEqual({ min: 1, max: count });
	});

	it("reads the legend back as ranks, most deprived first", () => {
		const { format } = map!.legend;
		expect(format(count, options)).toBe("Most deprived");
		expect(format(1, options)).toBe("Least deprived");
		expect(format(count - 99, options)).toBe("Rank 100");
	});
});

describe("deprivation aggregation", () => {
	it("is drawn by each index's own chart", () => {
		expect(definitionOf("imd").chart.componentPath).toBe(
			"@/components/deprivation/imd/IMDChart",
		);
		expect(definitionOf("nimdm").chart.key).toBe("society-nimdm");
	});
});
