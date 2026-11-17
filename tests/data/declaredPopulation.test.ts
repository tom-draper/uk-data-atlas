import { describe, expect, it } from "vitest";
import {
	DATASET_DECLARATIONS,
	ethnicity,
	population,
	statisticsOf,
	themeOfTopic,
} from "@uk-data-atlas/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { declaredMapView, declaredMapViews } from "@/lib/datasets/declared";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";
import { populationViewValue } from "@/lib/helpers/mapRendering/population";
import { parseVisualizationRef } from "@/lib/helpers/visualization";

const declared = [ethnicity, population];

describe("declared ethnicity and population datasets", () => {
	it("registers each under its id and the population module", () => {
		expect(declared.map((dataset) => dataset.id)).toEqual([
			"ethnicity",
			"population",
		]);
		for (const dataset of declared) {
			expect(DATASET_DECLARATIONS).toContain(dataset);
			expect(themeOfTopic(dataset.topic)).toBe("population");
		}
	});

	it("writes statistics headers whose type is the declaration id", () => {
		for (const dataset of declared) {
			const payload = statisticsOf(dataset).payload!;
			const parts =
				typeof payload.parts === "function"
					? payload.parts(["2021", "2022"])
					: payload.parts;
			expect(parts.length).toBeGreaterThan(0);
			for (const part of parts) expect(part.header.type).toBe(dataset.id);
		}
	});

	it("keeps a hand-written definition with its map renderer and charts", () => {
		for (const dataset of declared) {
			const definition = CHART_DATASET_DEFINITIONS.find(
				(candidate) => candidate.type === dataset.id,
			);
			expect(definition?.mapRenderer).toBeDefined();
			expect(definition?.precompiledFile).toBe(dataset.id);
		}
		const population = CHART_DATASET_DEFINITIONS.find(
			({ type }) => type === "population",
		);
		expect(population?.charts?.map((chart) => chart.key)).toEqual([
			"demographics-populationDensity",
			"demographics-age",
			"demographics-gender",
		]);
	});
});

describe("population map views", () => {
	const record = {
		total: { "20": 50, "40": 50 },
		males: { "20": 30, "40": 30 },
		females: { "20": 20, "40": 20 },
	} as never;
	const ctx = {
		featureBuilder: { getFeatureAreaSqKm: () => 4 },
	} as never;
	const valueOf = (id: string) =>
		populationViewValue(
			ctx,
			declaredMapView("population", id)!,
			record,
			{} as never,
		);

	it("lists density first, as the view a link without one gets", () => {
		expect(declaredMapViews("population")!.map(({ id }) => id)).toEqual([
			"density",
			"age",
			"gender",
		]);
		expect(declaredMapView("population", undefined)!.id).toBe("density");
		expect(declaredMapView("population", "unknown")!.id).toBe("density");
		expect(declaredMapView("ethnicity", "age")).toBeUndefined();
	});

	it("colours by people per square kilometre, median age and the male surplus", () => {
		expect(valueOf("density")).toBe(25);
		expect(valueOf("age")).toBe(20);
		expect(valueOf("gender")).toBe(0.5);
		expect(
			populationViewValue(
				ctx,
				declaredMapView("population", "age")!,
				undefined,
				{} as never,
			),
		).toBeNull();
	});

	it("starts each colour range where its map options group always did", () => {
		expect(DEFAULT_MAP_OPTIONS.ageDistribution.colorRange).toEqual({
			min: 25,
			max: 65,
		});
		expect(DEFAULT_MAP_OPTIONS.populationDensity.colorRange).toEqual({
			min: 0,
			max: 8000,
		});
		expect(DEFAULT_MAP_OPTIONS.gender.colorRange).toEqual({
			min: -0.1,
			max: 0.1,
		});
	});

	it("keeps the view names a link may carry", () => {
		for (const view of ["age", "density", "gender"])
			expect(
				parseVisualizationRef(
					new URLSearchParams(
						`dataset=population&period=2022&view=${view}`,
					),
				)?.view,
			).toBe(view);
	});
});
