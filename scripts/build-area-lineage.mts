/**
 * Write the atlas's area lineage: for each geography it maps data across
 * years, where each area goes between the releases it serves, as the API's
 * geography resolver answers it. The atlas reads this file in place of
 * matching areas by name, so what the map shows is what the API would say.
 *
 * Needs the API's build output (pnpm --dir api build); the file it writes is
 * committed with the rest of public/data.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readApiCatalogues } from "../api/src/catalogueLoader";
import {
	compileAreaLineage,
	type AreaLineage,
} from "../lib/data/boundaries/areaLineage";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "public", "data", "datasets", "area-lineage.json");

/** The geographies the atlas carries data between years for. */
export const LINEAGE_GEOGRAPHIES = [
	"ward",
	"localAuthority",
	"constituency",
] as const;

/** A served asset's release id: `boundaries/ward/2024-12-uk-bgc/...`. */
const releaseOf = (asset: string) => asset.split("/").at(-2)!;

const { geographyResolver } = readApiCatalogues(join(ROOT, "api"));

const lineage: Record<string, AreaLineage> = {};
for (const geography of LINEAGE_GEOGRAPHIES) {
	const releases = [
		...new Set(
			Object.values(BOUNDARY_CATALOG[geography].vintages).map(releaseOf),
		),
	].sort();
	for (const release of releases)
		if (!geographyResolver.hasAreaRelease(geography, release))
			throw new Error(
				`${geography}/${release} is served by the atlas but not compiled by the API.`,
			);
	lineage[geography] = compileAreaLineage(
		geography,
		releases,
		(release) => geographyResolver.areaCodes(geography, release) ?? [],
		(code, from, to) =>
			geographyResolver.sameArea(
				{ geography, boundaryRelease: from, code },
				{ geography, boundaryRelease: to },
			)?.code,
	);
	const exceptions = lineage[geography].steps.reduce(
		(count, step) =>
			count +
			Object.keys(step.forward).length +
			Object.keys(step.backward).length,
		0,
	);
	console.log(
		`${geography}: ${releases.length} releases, ${exceptions} codes that do not carry on unchanged`,
	);
}
writeFileSync(OUTPUT, JSON.stringify(lineage));
console.log(`Wrote ${OUTPUT}`);
