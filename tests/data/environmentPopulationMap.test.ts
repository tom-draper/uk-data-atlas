import { describe, expect, it } from "vitest";
import { addPopulationMetrics } from "@uk-data-atlas/datasets";

describe("environment population metrics", () => {
	it("calculates rates from all resident ages and preserves published metrics", () => {
		const records = {
			E1: { value: 100, metrics: { recycledTonnes: 25 } },
			E2: { value: 50, metrics: {} },
		};
		addPopulationMetrics(
			records,
			{
				E1: {
					ladName: "Example",
					total: { "0": 20_000, "1": 30_000 },
					males: {},
					females: {},
				},
			},
			(record) => record.value,
		);
		expect(records.E1.metrics).toEqual({
			recycledTonnes: 25,
			per100kPopulation: 200,
		});
		expect(records.E2.metrics).toEqual({});
	});
});
