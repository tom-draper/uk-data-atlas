/**
 * Builds weighted crosswalk shards for the gazetteer (design doc 4.4). Expensive
 * (point-in-polygon over the building block) and changes only when boundaries
 * change, so it runs separately from the per-build precompile.
 *
 * Run: npx tsx scripts/gazetteer-crosswalks.ts
 */
import { readFile, writeFile } from "fs/promises";
import { gzipSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import { buildCrosswalk } from "../lib/data/gazetteer/build";
import { validateCrosswalk } from "../lib/data/gazetteer/validate";
import type { Crosswalk } from "../lib/data/gazetteer/types";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const OUT_DIRS = [
	join(ROOT, "data", "precompiled"),
	join(PUBLIC_DATA, "precompiled"),
];
const rel = (p: string) => p.slice(p.indexOf("/data/") + "/data/".length);

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type ConstituencyLadOverlaps = {
	version: 1;
	targetLocalAuthorityRelease: string;
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
	const [lsoa, lad] = await Promise.all([
		load(BOUNDARY_CATALOG.lsoa.vintages[2011]),
		load(targetLocalAuthorityAsset),
	]);
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
			`  ${release.id}: blocks(LSOA)=${lsoa.length} sources(con)=${con.length} targets(LAD)=${lad.length}`,
		);
		const { crosswalk, assigned, total } = buildCrosswalk(
			lsoa,
			con,
			BOUNDARY_CATALOG.constituency.properties.code,
			lad,
			BOUNDARY_CATALOG.localAuthority.properties.code,
			(d, t) => process.stdout.write(`  ${release.id} ${d}/${t}\r`),
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
	for (const dir of OUT_DIRS)
		await writeFile(join(dir, "constituency-lad-overlaps.json"), json);
	console.log(
		`  constituency-lad-overlaps.json: ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB raw, ${(gzipSync(json).length / 1024).toFixed(0)} KB gz`,
	);
	console.log("Done.");
}

main();
