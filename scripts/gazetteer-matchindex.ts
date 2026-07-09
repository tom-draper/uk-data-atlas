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
import { GEOJSON_PATHS, PROPERTY_KEYS, getProp } from "../lib/data/boundaries/boundaries";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const OUT_DIRS = [join(ROOT, "data", "precompiled"), join(PUBLIC_DATA, "precompiled")];
const paths = GEOJSON_PATHS as Record<string, Record<number, string>>;
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
	codeKeys: readonly string[];
	nameKeys: readonly string[];
}
const LEVELS: LevelDef[] = [
	{ boundaryType: "ward", codeKeys: PROPERTY_KEYS.wardCode, nameKeys: PROPERTY_KEYS.wardName },
	{ boundaryType: "constituency", codeKeys: PROPERTY_KEYS.constituencyCode, nameKeys: PROPERTY_KEYS.constituencyName },
	{ boundaryType: "localAuthority", codeKeys: PROPERTY_KEYS.ladCode, nameKeys: PROPERTY_KEYS.ladName },
	{ boundaryType: "lsoa", codeKeys: PROPERTY_KEYS.lsoaCode, nameKeys: PROPERTY_KEYS.lsoaName },
	{ boundaryType: "dataZone", codeKeys: PROPERTY_KEYS.dataZoneCode, nameKeys: PROPERTY_KEYS.dataZoneName },
	{ boundaryType: "superOutputArea", codeKeys: PROPERTY_KEYS.soaCode, nameKeys: PROPERTY_KEYS.soaName },
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
		const years = Object.keys(paths[lvl.boundaryType] ?? {}).map(Number);
		for (const year of years) {
			const feats = await load(paths[lvl.boundaryType][year]);
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
