import { expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { regionalGdpItl3Definition as definition } from "@/lib/datasets/regionalGdpItl3";
import { aggregateRegionalGdp } from "@/lib/helpers/datasetAggregation/numeric";
import type { RegionalGdpItl3Dataset } from "@uk-data-atlas/datasets/types/regionalGdp";
const dataset: RegionalGdpItl3Dataset = {
	id: "gdp2023",
	type: "regionalGdpItl3",
	year: 2023,
	boundaryType: "itl3",
	boundaryYear: 2025,
	data: {
		A: {
			itlCode: "A",
			itlName: "A",
			gdpMillionGbp: 120,
			gvaMillionGbp: 100,
		},
	},
};
it("switches the map, card and legend together and preserves missing areas", () => {
	const options = {
		...DEFAULT_MAP_OPTIONS,
		regionalGdpItl3: {
			...DEFAULT_MAP_OPTIONS.regionalGdpItl3,
			measure: "gva" as const,
		},
	};
	expect(definition.map!.valueFor!(dataset, "A", options)).toBe(100);
	expect(definition.map!.valueFor!(dataset, "missing", options)).toBeNull();
	expect(
		definition.chart.cardForOptions!(options).fromRecord(dataset, "A")
			?.value,
	).toBe(100);
	expect(definition.map!.legend.format(100, options)).toContain("GVA");
	expect(definition.map!.sourceMode!(dataset, options)).not.toBe(
		definition.map!.sourceMode!(dataset, DEFAULT_MAP_OPTIONS),
	);
});
it("sums GVA rather than averaging monetary totals", () => {
	const total = aggregateRegionalGdp([
		dataset.data.A,
		{ ...dataset.data.A, gvaMillionGbp: 50 },
	]);
	expect(
		definition.chart.cardForOptions!({
			...DEFAULT_MAP_OPTIONS,
			regionalGdpItl3: {
				...DEFAULT_MAP_OPTIONS.regionalGdpItl3,
				measure: "gva",
			},
		}).fromAggregate(total)?.value,
	).toBe(150);
});
