/**
 * Builds weighted crosswalk shards for the gazetteer (design doc 4.4). Expensive
 * (point-in-polygon over the building block) and changes only when boundaries
 * change, so it runs separately from the per-build precompile.
 *
 * The building blocks cover the UK, each nation weighted by the best measure
 * this repository holds: residents for England, Wales and Scotland, area for
 * Northern Ireland, which has no small-area population source here yet.
 *
 * Run: npx tsx scripts/gazetteer-crosswalks.ts
 */
import { readFile, writeFile } from "fs/promises";
import { gzipSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import { parseCsv } from "../lib/helpers/parseCsv";
import { getProp } from "../lib/data/boundaries/properties";
import { areaM2 } from "../lib/data/gazetteer/geometry";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import { buildCrosswalk } from "../lib/data/gazetteer/build";
import { validateCrosswalk } from "../lib/data/gazetteer/validate";
import type { Crosswalk } from "../lib/data/gazetteer/types";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const SOURCE_DATA = join(ROOT, "data");
const OUT_DIR = join(PUBLIC_DATA, "datasets");
const rel = (p: string) => p.slice(p.indexOf("/data/") + "/data/".length);

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type ConstituencyLadOverlaps = {
	version: 1;
	targetLocalAuthorityRelease: string;
	/** How each nation's building blocks are weighted, for readers. */
	weighting: Record<string, string>;
	/** Keyed by the boundary release ID, not election year. */
	releases: Record<string, Crosswalk>;
};

async function load(path: string): Promise<Feat[]> {
	const topo = JSON.parse(
		await readFile(join(PUBLIC_DATA, rel(path)), "utf8"),
	) as { objects: Record<string, unknown> };
	const name = Object.keys(topo.objects)[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fc = feature(
		topo as any,
		topo.objects[name] as any,
	) as unknown as GeoJSON.FeatureCollection;
	return fc.features as Feat[];
}

/** Residents by area code, from a CSV with a code and a count column. */
async function residents(
	path: string,
	codeColumn: string,
	countColumn: string,
): Promise<Map<string, number>> {
	const { data } = await parseCsv(
		await readFile(join(SOURCE_DATA, path), "utf8"),
		{ header: true },
	);
	const counts = new Map<string, number>();
	for (const row of data) {
		const count = Number(String(row[countColumn]).replace(/,/g, ""));
		if (row[codeColumn] && Number.isFinite(count))
			counts.set(row[codeColumn], count);
	}
	return counts;
}

/**
 * Small areas covering the UK, with what each weighs. A block missing from
 * its population table fails the build rather than silently weighing zero.
 */
async function loadBuildingBlocks() {
	const nations = [
		{
			name: "England and Wales",
			family: "lsoa",
			year: 2021,
			weighting:
				"residents: Census 2021 TS001 usual residents by 2021 LSOA",
			people: await residents(
				"demographics/population/census-2021-lsoa/census2021-ts001-lsoa.csv",
				"geography code",
				"Residence type: Total; measures: Value",
			),
		},
		{
			name: "Scotland",
			family: "dataZone",
			year: 2011,
			weighting:
				"residents: SIMD 2020 total population by 2011 data zone",
			people: await residents(
				"deprivation/simd/SIMD+2020v2+-+indicators.csv",
				"Data_Zone",
				"Total_population",
			),
		},
		{
			name: "Northern Ireland",
			family: "superOutputArea",
			year: 2011,
			weighting:
				"area: 2011 Super Output Areas (no small-area population source in data/)",
			people: undefined,
		},
	] as const;

	const blocks: Feat[] = [];
	const weights = new Map<Feat, number>();
	const weighting: Record<string, string> = {};
	for (const nation of nations) {
		const definition = BOUNDARY_CATALOG[nation.family];
		const features = await load(
			(definition.vintages as Record<number, string>)[nation.year],
		);
		const missing: string[] = [];
		for (const block of features) {
			const code = getProp(block.properties, definition.properties.code);
			const people = code ? nation.people?.get(code) : undefined;
			if (nation.people && people === undefined) {
				missing.push(code ?? "(no code)");
				continue;
			}
			blocks.push(block);
			weights.set(block, people ?? areaM2(block.geometry));
		}
		if (missing.length > 0)
			throw new Error(
				`${nation.name}: ${missing.length} blocks have no population, e.g. ${missing[0]}`,
			);
		weighting[nation.name] = nation.weighting;
		console.log(`  blocks: ${nation.name} ${features.length}`);
	}
	return {
		blocks,
		measure: (block: Feat) => weights.get(block) ?? 0,
		weighting,
	};
}

async function main() {
	console.log("Building gazetteer crosswalks...");
	const targetLocalAuthorityAsset =
		BOUNDARY_CATALOG.localAuthority.vintages[2025];
	const targetLocalAuthorityRelease =
		BOUNDARY_CATALOG.localAuthority.releases.find(
			(release) => release.asset === targetLocalAuthorityAsset,
		)?.id;
	if (!targetLocalAuthorityRelease)
		throw new Error("No release owns the 2025 local authority asset");
	const lad = await load(targetLocalAuthorityAsset);
	const { blocks, measure, weighting } = await loadBuildingBlocks();
	const releases = [
		...new Map(
			Object.values(BOUNDARY_CATALOG.constituency.vintages).map(
				(asset) => {
					const release = BOUNDARY_CATALOG.constituency.releases.find(
						(candidate) => candidate.asset === asset,
					);
					if (!release)
						throw new Error(
							`No release owns constituency asset ${asset}`,
						);
					return [release.id, release] as const;
				},
			),
		).values(),
	];
	const overlaps: ConstituencyLadOverlaps = {
		version: 1,
		targetLocalAuthorityRelease,
		weighting,
		releases: {},
	};
	const targetCodes = new Set<string>();
	for (const boundary of lad)
		for (const key of BOUNDARY_CATALOG.localAuthority.properties.code) {
			const code = boundary.properties[key];
			if (typeof code === "string") targetCodes.add(code);
		}

	for (const release of releases) {
		const con = await load(release.asset!);
		console.log(
			`  ${release.id}: blocks=${blocks.length} sources(con)=${con.length} targets(LAD)=${lad.length}`,
		);
		const { crosswalk, assigned, total } = buildCrosswalk(
			blocks,
			con,
			BOUNDARY_CATALOG.constituency.properties.code,
			lad,
			BOUNDARY_CATALOG.localAuthority.properties.code,
			{
				measure,
				onProgress: (d, t) =>
					process.stdout.write(`  ${release.id} ${d}/${t}\r`),
			},
		);
		console.log(`\n    assigned ${assigned}/${total} building blocks`);

		const errors = validateCrosswalk(
			`${release.id} constituency->localAuthority`,
			crosswalk,
			targetCodes,
		);
		if (errors.length) {
			throw new Error(
				`${release.id}: validation failed (${errors.length}): ${errors[0]}`,
			);
		}
		overlaps.releases[release.id] = crosswalk;
	}

	const json = JSON.stringify(overlaps);
	await writeFile(join(OUT_DIR, "constituency-lad-overlaps.json"), json);
	console.log(
		`  constituency-lad-overlaps.json: ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB raw, ${(gzipSync(json).length / 1024).toFixed(0)} KB gz`,
	);
	console.log("Done.");
}

main();
