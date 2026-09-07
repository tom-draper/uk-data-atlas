import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
} from "@/lib/data/boundaries/catalog";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";

/**
 * A chart card draws `boundaryData[dataset.boundaryType][dataset.boundaryYear]`.
 * When the catalogue has no release serving that year the lookup is `undefined`,
 * and nothing announces it: the card still renders, still aggregates to nothing,
 * and clicking it leaves whatever the map was already showing in place. The
 * failure looks exactly like a dead button, so assert the link here instead.
 */
describe("every chart dataset has a boundary to draw on", () => {
	const precompiled = join(process.cwd(), "data", "precompiled");

	for (const definition of CHART_DATASET_DEFINITIONS) {
		it(`${definition.type} resolves every boundary year it declares`, () => {
			const contents = JSON.parse(
				readFileSync(
					join(precompiled, `${definition.precompiledFile}.json`),
					"utf8",
				),
			) as Record<
				string,
				{ boundaryType: BoundaryType; boundaryYear: number }
			>;

			const unserved = Object.entries(contents)
				.filter(
					([, dataset]) =>
						!BOUNDARY_CATALOG[dataset.boundaryType]?.vintages[
							dataset.boundaryYear
						],
				)
				.map(
					([key, dataset]) =>
						`${key} wants ${dataset.boundaryType} ${dataset.boundaryYear}`,
				);

			expect(unserved).toEqual([]);
		});
	}
});
