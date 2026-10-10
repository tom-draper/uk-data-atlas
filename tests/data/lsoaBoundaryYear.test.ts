import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog";

const datasets = join(process.cwd(), "public", "data", "datasets");
const read = (file: string) =>
	JSON.parse(readFileSync(join(datasets, file), "utf8"));

type Edition = { boundaryYear?: number; data?: Record<string, unknown> };

// An edition names the LSOA release its codes belong to, and everything that
// joins it to geometry or to a council reads that release. A label for the
// wrong release does not fail loudly: the codes it lacks drop out of council
// totals and are left unfilled on the map.
describe("LSOA datasets", () => {
	const lsoaFiles = CATALOGUE_DATASET_DEFINITIONS.filter(
		(definition) => definition.boundaryType === "lsoa",
	).map((definition) => definition.precompiledFile);

	it.each(lsoaFiles)(
		"%s names the release its English codes belong to",
		(file) => {
			const editions = read(`${file}.json`) as Record<string, Edition>;
			for (const [id, edition] of Object.entries(editions)) {
				if (!edition.data || edition.boundaryYear === undefined)
					continue;
				const codes = Object.keys(edition.data).filter((code) =>
					code.startsWith("E01"),
				);
				if (codes.length === 0) continue;
				const { lsoaToLad } = read(
					`lsoa-lad-mappings-${edition.boundaryYear}.json`,
				) as { lsoaToLad: Record<string, string> };
				const missing = codes.filter((code) => !(code in lsoaToLad));
				expect(
					missing,
					`${file} ${id}: ${missing.length} of ${codes.length} codes are not in the ${edition.boundaryYear} LSOA release`,
				).toEqual([]);
			}
		},
	);
});
