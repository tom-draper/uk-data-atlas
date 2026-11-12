import { describe, expect, it } from "vitest";
import {
	DATASET_DECLARATIONS,
	ethnicity,
	population,
	statisticsOf,
} from "@uk-data-atlas/datasets";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";

const declared = [ethnicity, population];

describe("declared ethnicity and population datasets", () => {
	it("registers each under its id and the population module", () => {
		expect(declared.map((dataset) => dataset.id)).toEqual([
			"ethnicity",
			"population",
		]);
		for (const dataset of declared) {
			expect(DATASET_DECLARATIONS).toContain(dataset);
			expect(dataset.module).toBe("population");
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
