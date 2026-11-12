import { describe, expect, it } from "vitest";
import {
	DATASET_DECLARATIONS,
	brexit,
	brexitConstituency,
	generalElection,
	localElection,
	statisticsOf,
} from "@uk-data-atlas/datasets";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";

const politics = [brexit, brexitConstituency, generalElection, localElection];

describe("declared politics datasets", () => {
	it("registers each under its kebab-case id and the politics module", () => {
		expect(politics.map((dataset) => dataset.id)).toEqual([
			"brexit",
			"brexit-constituency",
			"general-election",
			"local-election",
		]);
		for (const dataset of politics) {
			expect(DATASET_DECLARATIONS).toContain(dataset);
			expect(dataset.module).toBe("politics");
		}
	});

	it("writes statistics headers whose type is the declaration id", () => {
		for (const dataset of politics) {
			const { payload } = statisticsOf(dataset);
			const parts =
				typeof payload.parts === "function"
					? payload.parts(["2016"])
					: payload.parts;
			for (const part of parts) expect(part.header.type).toBe(dataset.id);
		}
	});

	it("keeps a hand-written chart definition for each, on the declared type", () => {
		for (const dataset of politics) {
			const definition = CHART_DATASET_DEFINITIONS.find(
				(candidate) => candidate.type === dataset.id,
			);
			expect(definition?.mapRenderer).toBeDefined();
			expect(definition?.precompiledFile).toBe(dataset.id);
		}
	});

	it("keeps the chart keys of the elections", () => {
		const keys = (type: string) =>
			CHART_DATASET_DEFINITIONS.find(
				(candidate) => candidate.type === type,
			)?.charts?.map((chart) => chart.key);
		expect(keys("general-election")).toEqual([
			"generalElection-2024",
			"generalElection-2019",
			"generalElection-2017",
			"generalElection-2015",
			"generalElection-2010",
		]);
		expect(keys("local-election")?.[0]).toBe("localElection-2025");
	});
});
