/**
 * Builds the gazetteer match index (design doc 4.6): per boundary level+vintage,
 * the set of codes and a name->code map, used to match uploaded CSV columns to a
 * geography. Replaces runtime buildAreaBank(rawData) with precomputed data so
 * matching works against every geography, not just the ones currently loaded.
 *
 * Run: npx tsx scripts/gazetteer-matchindex.ts
 */
import { readFile, writeFile } from "fs/promises";
import { gzipSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import { getProp } from "../lib/data/boundaries/boundaries";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const OUT_DIRS = [join(ROOT, "data", "precompiled"), join(PUBLIC_DATA, "precompiled")];
const rel = (p: string) => p.slice(p.indexOf("/data/") + "/data/".length);

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

async function load(path: string): Promise<Feat[]> {
	const topo = JSON.parse(await readFile(join(PUBLIC_DATA, rel(path)), "utf8")) as { objects: Record<string, unknown> };
	const name = Object.keys(topo.objects)[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fc = feature(topo as any, topo.objects[name] as any) as unknown as GeoJSON.FeatureCollection;
	return fc.features as Feat[];
}

interface LevelDef {
	boundaryType: string;
	vintages: Record<number, string>;
	codeKeys: readonly string[];
	nameKeys: readonly string[];
}
const LEVELS: LevelDef[] = [
	{ boundaryType: "ward", vintages: BOUNDARY_CATALOG.ward.vintages, codeKeys: BOUNDARY_CATALOG.ward.properties.code, nameKeys: BOUNDARY_CATALOG.ward.properties.name },
	{ boundaryType: "constituency", vintages: BOUNDARY_CATALOG.constituency.vintages, codeKeys: BOUNDARY_CATALOG.constituency.properties.code, nameKeys: BOUNDARY_CATALOG.constituency.properties.name },
	{ boundaryType: "localAuthority", vintages: BOUNDARY_CATALOG.localAuthority.vintages, codeKeys: BOUNDARY_CATALOG.localAuthority.properties.code, nameKeys: BOUNDARY_CATALOG.localAuthority.properties.name },
	{ boundaryType: "lsoa", vintages: BOUNDARY_CATALOG.lsoa.vintages, codeKeys: BOUNDARY_CATALOG.lsoa.properties.code, nameKeys: BOUNDARY_CATALOG.lsoa.properties.name },
	{ boundaryType: "dataZone", vintages: BOUNDARY_CATALOG.dataZone.vintages, codeKeys: BOUNDARY_CATALOG.dataZone.properties.code, nameKeys: BOUNDARY_CATALOG.dataZone.properties.name },
	{ boundaryType: "superOutputArea", vintages: BOUNDARY_CATALOG.superOutputArea.vintages, codeKeys: BOUNDARY_CATALOG.superOutputArea.properties.code, nameKeys: BOUNDARY_CATALOG.superOutputArea.properties.name },
];

type MatchIndex = Record<string, Record<number, { codes: string[]; names: Record<string, string> }>>;

const sizes = (o: unknown) => {
	const j = JSON.stringify(o);
	return `${(Buffer.byteLength(j) / 1024).toFixed(0)} KB raw / ${(gzipSync(j).length / 1024).toFixed(0)} KB gz`;
};

async function main() {
	console.log("Building match index...");
	const index: MatchIndex = {};
	for (const lvl of LEVELS) {
		const years = Object.keys(lvl.vintages).map(Number);
		for (const year of years) {
			const feats = await load(lvl.vintages[year]);
			const codes = new Set<string>();
			const names: Record<string, string> = {};
			for (const f of feats) {
				const code = getProp(f.properties, lvl.codeKeys);
				const name = getProp(f.properties, lvl.nameKeys);
				if (code) codes.add(code);
				if (name && code) names[name.toLowerCase()] = code;
			}
			(index[lvl.boundaryType] ??= {})[year] = { codes: [...codes], names };
			console.log(`  ${lvl.boundaryType} ${year}: ${codes.size} codes, ${Object.keys(names).length} names`);
		}
	}

	console.log("\nTotal:", sizes(index));
	for (const [bt, byYear] of Object.entries(index))
		console.log(`  ${bt}: ${sizes(byYear)}`);

	const json = JSON.stringify(index);
	for (const dir of OUT_DIRS) await writeFile(join(dir, "gazetteer.matchindex.json"), json);
	console.log("Done.");
}

main();
