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

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const OUT_DIRS = [
	join(ROOT, "data", "precompiled"),
	join(PUBLIC_DATA, "precompiled"),
];
const rel = (p: string) => p.slice(p.indexOf("/data/") + "/data/".length);

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

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
	const [lsoa, con, lad] = await Promise.all([
		load(BOUNDARY_CATALOG.lsoa.vintages[2011]),
		load(BOUNDARY_CATALOG.constituency.vintages[2024]),
		load(BOUNDARY_CATALOG.localAuthority.vintages[2025]),
	]);
	console.log(
		`  blocks(LSOA)=${lsoa.length} sources(con)=${con.length} targets(LAD)=${lad.length}`,
	);

	const { crosswalk, assigned, total } = buildCrosswalk(
		lsoa,
		con,
		BOUNDARY_CATALOG.constituency.properties.code,
		lad,
		BOUNDARY_CATALOG.localAuthority.properties.code,
		(d, t) => process.stdout.write(`  ${d}/${t}\r`),
	);
	console.log(`\n  assigned ${assigned}/${total} building blocks`);

	const tset = new Set<string>();
	for (const f of lad)
		for (const k of BOUNDARY_CATALOG.localAuthority.properties.code)
			if (f.properties[k]) tset.add(f.properties[k] as string);
	const errors = validateCrosswalk(
		"constituency->localAuthority",
		crosswalk,
		tset,
	);
	if (errors.length) {
		console.error(`  VALIDATION FAILED (${errors.length}): ${errors[0]}`);
		process.exit(1);
	}

	const json = JSON.stringify(crosswalk);
	for (const dir of OUT_DIRS)
		await writeFile(
			join(dir, "crosswalk.constituency-localAuthority.json"),
			json,
		);
	console.log(
		`  crosswalk.constituency-localAuthority.json: ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB raw, ${(gzipSync(json).length / 1024).toFixed(0)} KB gz`,
	);
	console.log("Done.");
}

main();
