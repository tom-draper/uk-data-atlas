/**
 * Write the atlas's ward containment: the local authority and constituencies
 * each served ward release sits in, as the API's geography resolver places
 * them. The atlas reads this file in place of deriving containment from
 * boundary files, so what the map shows is what the API would say.
 *
 * Needs the API's build output (pnpm --dir api build); the file it writes is
 * committed with the rest of public/data, and the precompile reads it.
 * `--check` fails instead of writing when the committed file is out of date.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readApiCatalogues } from "../api/src/catalogueLoader";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import { encodeBoundaryMappings } from "../lib/data/boundaries/mappings";
import {
	compileAreaContainment,
	type ContainmentCrosswalk,
} from "./area-containment";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(
	ROOT,
	"public",
	"data",
	"datasets",
	"boundary-mappings.json",
);

/** A served asset's release id: `boundaries/ward/2024-12-uk-bgc/...`. */
const releaseOf = (asset: string) => asset.split("/").at(-2)!;

const { geographyResolver } = readApiCatalogues(join(ROOT, "api"));

const wardReleases = Object.entries(BOUNDARY_CATALOG.ward.vintages).map(
	([year, asset]) => ({ year: Number(year), release: releaseOf(asset) }),
);
for (const { release } of wardReleases)
	if (!geographyResolver.hasAreaRelease("ward", release))
		throw new Error(
			`ward/${release} is served by the atlas but not compiled by the API.`,
		);

const served = new Set(wardReleases.map(({ release }) => release));
const crosswalks = geographyResolver
	.crosswalkSummaries()
	.filter(
		(summary) =>
			summary.from.geography === "ward" &&
			served.has(summary.from.boundaryRelease) &&
			(summary.to.geography === "localAuthority" ||
				summary.to.geography === "constituency"),
	)
	.map((summary): ContainmentCrosswalk => {
		const artifact = geographyResolver.crosswalk(summary.id);
		if (!artifact)
			throw new Error(
				`The resolver lists ${summary.id} but cannot read it.`,
			);
		return artifact;
	});

const containment = compileAreaContainment(wardReleases, crosswalks);
const json = JSON.stringify(encodeBoundaryMappings(containment));

// `--check` compares the committed file with what the resolver now says, so
// a rebuilt API that places a ward elsewhere fails the full check.
if (process.argv.includes("--check")) {
	if (readFileSync(OUTPUT, "utf8") !== json) {
		console.error(
			`${OUTPUT} differs from the resolver's containment; run pnpm containment:build.`,
		);
		process.exit(1);
	}
	console.log("The committed ward containment is the resolver's.");
} else {
	writeFileSync(OUTPUT, json);
	console.log(
		`${Object.keys(containment.wardToLad).length} wards placed in a local authority; ` +
			`constituencies for ${Object.keys(containment.constituencyToWards).length} ward releases`,
	);
	console.log(`Wrote ${OUTPUT}`);
}
