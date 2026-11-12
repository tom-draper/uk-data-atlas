import { describe, expect, it } from "vitest";
import { fuelPoverty, statisticsOf } from "@uk-data-atlas/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";
import {
	mapOptionsFromSearchParams,
	writeMapOptions,
} from "@/lib/helpers/mapOptionsUrl";

describe("fuel poverty declaration", () => {
	it("is a deprivation dataset whose 2024 edition carries its id as its type", () => {
		expect(fuelPoverty.id).toBe("fuel-poverty");
		expect(fuelPoverty.module).toBe("deprivation");
		const payload = statisticsOf(fuelPoverty).payload!;
		const parts =
			typeof payload.parts === "function"
				? payload.parts(["2024"])
				: payload.parts;
		expect(parts.map((part) => part.key)).toEqual(["2024"]);
		expect(parts[0]!.header).toMatchObject({
			id: "fuel-poverty2024",
			type: "fuel-poverty",
			boundaryType: "lsoa",
			boundaryYear: 2021,
		});
	});

	it("measures the rate as fuel poor households over households", () => {
		const rate = statisticsOf(fuelPoverty).measures.find(
			(measure) => measure.slug === "fuel-poverty-rate",
		);
		expect(rate).toMatchObject({
			aggregation: "ratio",
			numerator: "fuel-poor-households",
			denominator: "households",
		});
	});

	it("keeps its hand-written chart, map and England coverage", () => {
		const definition = CHART_DATASET_DEFINITIONS.find(
			(candidate) => candidate.type === "fuel-poverty",
		);
		expect(definition?.chart.key).toBe("economics-fuelPoverty");
		expect(definition?.map?.valueFor).toBeTypeOf("function");
		expect(definition?.coverageCountries).toEqual(["GB-ENG"]);
		expect(DEFAULT_MAP_OPTIONS["fuel-poverty"].measure).toBe("rate");
	});

	it("keeps the range name of shared links", () => {
		const options = mapOptionsFromSearchParams(
			new URLSearchParams("range.fuelPoverty=4,12"),
		);
		expect(options["fuel-poverty"].colorRange).toEqual({
			min: 4,
			max: 12,
		});
		const params = new URLSearchParams();
		writeMapOptions(params, options);
		expect(params.toString()).toBe("range.fuelPoverty=4%2C12");
	});
});
