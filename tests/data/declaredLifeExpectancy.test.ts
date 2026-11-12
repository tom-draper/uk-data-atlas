import { describe, expect, it } from "vitest";
import { lifeExpectancy, statisticsOf } from "@uk-data-atlas/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";
import {
	mapOptionsFromSearchParams,
	writeMapOptions,
} from "@/lib/helpers/mapOptionsUrl";

describe("life expectancy declaration", () => {
	it("is a health dataset whose two editions carry its id as their type", () => {
		expect(lifeExpectancy.id).toBe("life-expectancy");
		expect(lifeExpectancy.module).toBe("health");
		const payload = statisticsOf(lifeExpectancy).payload!;
		const parts =
			typeof payload.parts === "function"
				? payload.parts([])
				: payload.parts;
		expect(parts.map((part) => part.key)).toEqual(["le", "hle"]);
		for (const part of parts)
			expect(part.header.type).toBe("life-expectancy");
	});

	it("keeps its hand-written chart and map", () => {
		const definition = CHART_DATASET_DEFINITIONS.find(
			(candidate) => candidate.type === "life-expectancy",
		);
		expect(definition?.chart.key).toBe("health-lifeExpectancy");
		expect(definition?.map?.valueFor).toBeTypeOf("function");
		expect(DEFAULT_MAP_OPTIONS["life-expectancy"].measure).toBe("average");
	});

	it("keeps the measure and range names of shared links", () => {
		const options = mapOptionsFromSearchParams(
			new URLSearchParams(
				"measure.lifeExpectancy=male&range.lifeExpectancy=74,82",
			),
		);
		expect(options["life-expectancy"]).toMatchObject({
			measure: "male",
			colorRange: { min: 74, max: 82 },
		});
		const params = new URLSearchParams();
		writeMapOptions(params, options);
		expect(params.toString()).toBe(
			"range.lifeExpectancy=74%2C82&measure.lifeExpectancy=male",
		);
	});
});
