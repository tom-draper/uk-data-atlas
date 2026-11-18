import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import type { Measure } from "@uk-data-atlas/measures";
import { compileYearlyIndicators } from "../../src/catalog/declaredIndicators.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { withFixtureFiles } from "./indicatorFixtures.ts";

/**
 * Emissions, the deprivation indices and the Northern Ireland measure were
 * once a compiler each. The golden file is what those compilers produced for
 * the fixtures, so a declaration that reads differently fails here.
 */
const golden = JSON.parse(
	readFileSync(
		new URL("./fixtures/declaredSeries.golden.json", import.meta.url),
		"utf8",
	),
) as Record<string, ReturnType<typeof compileYearlyIndicators>>;

/** The catalogue names a series for a measure that left it out, as `{ measure: id }`. */
const withoutDefaultSeries = (measure: Measure): Measure => {
	const { series, ...rest } = measure;
	return series && series.measure === measure.id && !series.dimensions
		? rest
		: measure;
};

test.each(Object.keys(golden))(
	"%s publishes the measures its compiler used to",
	(id) => {
		const declaration = DATASET_DECLARATIONS.find(
			(candidate) => candidate.id === id,
		)!;
		const published = withFixtureFiles((paths, manifest) =>
			compileYearlyIndicators(manifest, declaration, paths[id]!),
		);
		expect(published.measures.map(withoutDefaultSeries)).toEqual(
			golden[id]!.measures,
		);
		expect(published.artifacts).toEqual(golden[id]!.artifacts);
		for (const { contentHash, ...artifact } of published.artifacts)
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	},
);
