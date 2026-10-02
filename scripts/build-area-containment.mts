/**
 * Write the atlas's area containment, as the API's geography resolver places
 * it: the local authority and constituencies each served ward release sits
 * in, the local authority of each served LSOA and parish release, and the
 * authorities each served constituency release overlaps. The atlas reads
 * these files in place of deriving containment from boundary files, so what
 * the map shows is what the API would say.
 *
 * Needs the API's build output (pnpm --dir services/api build); the files it writes
 * are committed with the rest of public/data, and the precompile reads the
 * ward and parish ones. `--check` fails instead of writing when a committed
 * file is out of date.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readApiCatalogues } from "../services/api/src/catalogueLoader";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import {
	encodeBoundaryMappings,
	encodeParishLadMappings,
} from "@uk-data-atlas/geography";
import type { LsoaLadMapping } from "../lib/data/boundaries/lsoaLadMappings";
import {
	compileAreaContainment,
	compileConstituencyLadOverlaps,
	compileLsoaLadContainment,
	compileParishLadContainment,
	type ContainmentCrosswalk,
	type OverlapCrosswalk,
} from "./area-containment";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATASETS = join(ROOT, "public", "data", "datasets");

/** A served asset's release id: `boundaries/ward/2024-12-uk-bgc/...`. */
const releaseOf = (asset: string) => asset.split("/").at(-2)!;

const { geographyResolver } = readApiCatalogues(join(ROOT, "services", "api"));

const wardReleases = Object.entries(BOUNDARY_CATALOG.ward.vintages).map(
	([year, asset]) => ({ year: Number(year), release: releaseOf(asset) }),
);
for (const { release } of wardReleases)
	if (!geographyResolver.hasAreaRelease("ward", release))
		throw new Error(
			`ward/${release} is served by the atlas but not compiled by the API.`,
		);

const lsoaReleases = Object.entries(BOUNDARY_CATALOG.lsoa.vintages).map(
	([year, asset]) => ({ year: Number(year), release: releaseOf(asset) }),
);
for (const { release } of lsoaReleases)
	if (!geographyResolver.hasAreaRelease("lsoa", release))
		throw new Error(
			`lsoa/${release} is served by the atlas but not compiled by the API.`,
		);

const parishReleases = Object.entries(BOUNDARY_CATALOG.parish.vintages).map(
	([year, asset]) => ({ year: Number(year), release: releaseOf(asset) }),
);
for (const { release } of parishReleases)
	if (!geographyResolver.hasAreaRelease("parish", release))
		throw new Error(
			`parish/${release} is served by the atlas but not compiled by the API.`,
		);

const served = new Set(
	[...wardReleases, ...lsoaReleases, ...parishReleases].map(
		({ release }) => release,
	),
);
const crosswalks = geographyResolver
	.crosswalkSummaries()
	.filter(
		(summary) =>
			(summary.from.geography === "ward" ||
				summary.from.geography === "lsoa" ||
				summary.from.geography === "parish") &&
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

const containment = compileAreaContainment(
	wardReleases,
	crosswalks.filter(({ from }) => from.geography === "ward"),
);

// LSOAs are placed in the newest authorities; a published authority is
// carried there by the resolver's lineage.
const newestLad = releaseOf(
	BOUNDARY_CATALOG.localAuthority.vintages[
		Math.max(
			...Object.keys(BOUNDARY_CATALOG.localAuthority.vintages).map(
				Number,
			),
		)
	]!,
);
const lsoaToLad = compileLsoaLadContainment(
	lsoaReleases,
	crosswalks.filter(({ from }) => from.geography === "lsoa"),
	(code, release) =>
		geographyResolver.sameArea(
			{ geography: "localAuthority", boundaryRelease: release, code },
			{ geography: "localAuthority", boundaryRelease: newestLad },
		)?.code,
);

// Constituencies straddle authorities, so each is listed with the share of
// it every authority holds, in the authorities the gazetteer speaks.
const overlapLad = releaseOf(BOUNDARY_CATALOG.localAuthority.vintages[2025]!);
const constituencyReleases = [
	...new Set(
		Object.values(BOUNDARY_CATALOG.constituency.vintages).map(releaseOf),
	),
]
	.sort()
	.map((release) => ({
		release,
		codes: geographyResolver.areaCodes("constituency", release) ?? [],
	}));
const overlapCrosswalks = geographyResolver
	.crosswalkSummaries()
	.filter(
		(summary) =>
			summary.from.geography === "constituency" &&
			summary.to.geography === "localAuthority" &&
			summary.to.boundaryRelease === overlapLad &&
			(summary.method === "area-overlap" ||
				summary.method === "population-overlap"),
	)
	.map(
		(summary) =>
			geographyResolver.crosswalk(summary.id) as OverlapCrosswalk,
	);
const constituencyOverlaps = compileConstituencyLadOverlaps(
	constituencyReleases,
	overlapCrosswalks,
);

const parishToLad = compileParishLadContainment(
	parishReleases,
	crosswalks.filter(({ from }) => from.geography === "parish"),
);

const outputs = new Map<string, string>([
	[
		"parish-lad-mappings.json",
		JSON.stringify(encodeParishLadMappings(parishToLad)),
	],
	[
		"boundary-mappings.json",
		JSON.stringify(encodeBoundaryMappings(containment)),
	],
	[
		"constituency-lad-overlaps.json",
		JSON.stringify({
			version: 1,
			targetLocalAuthorityRelease: overlapLad,
			...constituencyOverlaps,
		}),
	],
	...Object.entries(lsoaToLad).map(
		([year, mapping]) =>
			[
				`lsoa-lad-mappings-${year}.json`,
				JSON.stringify({
					version: 1,
					year: Number(year),
					lsoaToLad: mapping,
				} satisfies LsoaLadMapping),
			] as const,
	),
]);

// `--check` compares the committed files with what the resolver now says, so
// a rebuilt API that places an area elsewhere fails the full check.
if (process.argv.includes("--check")) {
	const stale = [...outputs].filter(
		([name, json]) => readFileSync(join(DATASETS, name), "utf8") !== json,
	);
	for (const [name] of stale)
		console.error(
			`${name} differs from the resolver's containment; run pnpm containment:build.`,
		);
	if (stale.length > 0) process.exit(1);
	console.log("The committed area containment is the resolver's.");
} else {
	for (const [name, json] of outputs) {
		writeFileSync(join(DATASETS, name), json);
		console.log(`Wrote ${name}`);
	}
	console.log(
		`${Object.keys(containment.wardToLad).length} wards placed in a local authority; ` +
			`constituencies for ${Object.keys(containment.constituencyToWards).length} ward releases; ` +
			Object.entries(lsoaToLad)
				.map(
					([year, mapping]) =>
						`${Object.keys(mapping).length} LSOAs of ${year}`,
				)
				.join(", ") +
			" placed in a local authority",
	);
}
