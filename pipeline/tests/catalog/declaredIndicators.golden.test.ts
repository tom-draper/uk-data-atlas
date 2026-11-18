import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import { compileDeclaredIndicators } from "../../src/catalog/declaredIndicators.ts";
import { sha256 } from "../../src/catalog/values.ts";
import { FIXTURE_ENGLAND_2025, withFixtureFiles } from "./indicatorFixtures.ts";

/**
 * The measures these datasets publish were once written by a compiler per
 * dataset. The golden file is what those compilers produced for the fixtures,
 * so a declaration that reads differently from them fails here.
 */
const golden = JSON.parse(
	readFileSync(
		new URL("./fixtures/declaredIndicators.golden.json", import.meta.url),
		"utf8",
	),
) as Record<string, ReturnType<typeof compileDeclaredIndicators>>;

test.each(Object.keys(golden))(
	"%s publishes the measures its compiler used to",
	(id) => {
		const declaration = DATASET_DECLARATIONS.find(
			(candidate) => candidate.id === id,
		)!;
		const published = withFixtureFiles((paths, manifest) =>
			compileDeclaredIndicators(manifest, declaration, paths[id]!, {
				authorities: FIXTURE_ENGLAND_2025,
				england2025: FIXTURE_ENGLAND_2025,
			}),
		);
		expect(published).toEqual(golden[id]);
		for (const {
			artifact: { contentHash, ...artifact },
		} of published)
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	},
);
