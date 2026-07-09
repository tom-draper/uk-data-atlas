/**
 * Gazetteer Phase 0: measure real artifact sizes and validate the weight
 * derivation pipeline (design doc 3.1 / 4.4 / 6.1). Throwaway measurement
 * harness, not shipped code. Run: npx tsx scripts/gazetteer-phase0.ts
 */
import { readFileSync } from "fs";
import { gzipSync } from "zlib";
import { join } from "path";
import { feature } from "topojson-client";
import { polygonAreaSqKm } from "../lib/helpers/population";
import { getProp, PROPERTY_KEYS } from "../lib/data/boundaries/boundaries";

const B = join(process.cwd(), "public", "data", "boundaries");
const FILES = {
	lad: join(B, "lad", "LAD_MAY_2025_UK_BGC_V2_1110015208521213948.topojson"),
	con: join(B, "constituencies", "Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.topojson"),
	lsoa: join(B, "lsoa", "LSOA_Dec_2011_Boundaries_Generalised_Clipped_BGC_EW_V3_1201710622178571867.topojson"),
};

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

function load(path: string): Feat[] {
	const topo = JSON.parse(readFileSync(path, "utf8"));
	const name = Object.keys(topo.objects)[0];
	const fc = feature(topo, topo.objects[name]) as unknown as GeoJSON.FeatureCollection;
	return fc.features as Feat[];
}

const sizes = (obj: unknown) => {
	const json = JSON.stringify(obj);
	const raw = Buffer.byteLength(json);
	const gz = gzipSync(json).length;
	return { rawKB: +(raw / 1024).toFixed(0), gzKB: +(gz / 1024).toFixed(0) };
};

// --- geometry helpers ---
function outerRings(geom: GeoJSON.Geometry): number[][][] {
	if (geom.type === "Polygon") return [geom.coordinates[0]];
	if (geom.type === "MultiPolygon") return geom.coordinates.map((p) => p[0]);
	return [];
}
function bboxOf(geom: GeoJSON.Geometry): [number, number, number, number] {
	let minX = 180, minY = 90, maxX = -180, maxY = -90;
	for (const ring of outerRings(geom))
		for (const [x, y] of ring) {
			if (x < minX) minX = x; if (x > maxX) maxX = x;
			if (y < minY) minY = y; if (y > maxY) maxY = y;
		}
	return [minX, minY, maxX, maxY];
}
function centroidOf(geom: GeoJSON.Geometry): [number, number] {
	// area-weighted-ish: use vertices of the largest outer ring
	let best: number[][] = [], bestLen = -1;
	for (const ring of outerRings(geom)) if (ring.length > bestLen) { best = ring; bestLen = ring.length; }
	let sx = 0, sy = 0;
	for (const [x, y] of best) { sx += x; sy += y; }
	return [sx / best.length, sy / best.length];
}
function pointInRing(px: number, py: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
		if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}
function pointInFeat(px: number, py: number, geom: GeoJSON.Geometry): boolean {
	for (const ring of outerRings(geom)) if (pointInRing(px, py, ring)) return true;
	return false;
}
const areaM2 = (geom: GeoJSON.Geometry) =>
	Math.round(polygonAreaSqKm((geom as any).coordinates) * 1e6);

// --- build eager core entries (LAD + constituency) ---
function coreEntries(feats: Feat[], codeKeys: readonly string[], nameKeys: readonly string[], level: string) {
	const byCode: Record<string, unknown> = {};
	for (const f of feats) {
		const code = getProp(f.properties, codeKeys);
		if (!code) continue;
		byCode[code] = {
			code,
			name: getProp(f.properties, nameKeys) ?? "",
			level,
			vintage: level === "localAuthority" ? 2025 : 2024,
			areaM2: areaM2(f.geometry),
			bbox: bboxOf(f.geometry).map((n) => +n.toFixed(4)),
			parents: [] as string[],
		};
	}
	return byCode;
}

console.log("Loading boundaries...");
const lad = load(FILES.lad);
const con = load(FILES.con);
console.log(`  LAD: ${lad.length}, Constituency: ${con.length}`);

const ladCore = coreEntries(lad, PROPERTY_KEYS.ladCode, PROPERTY_KEYS.ladName, "localAuthority");
const conCore = coreEntries(con, PROPERTY_KEYS.constituencyCode, PROPERTY_KEYS.constituencyName, "constituency");
const core = { ...ladCore, ...conCore };
console.log(`\n[CORE] LAD+constituency entries: ${Object.keys(core).length}`, sizes(core));

// --- building-block table from LSOA (proxy for OA) ---
console.log("\nLoading LSOA (building block)...");
const lsoa = load(FILES.lsoa);
console.log(`  LSOA (E+W): ${lsoa.length}`);
const bbTable = lsoa.map((f) => ({
	code: getProp(f.properties, PROPERTY_KEYS.lsoaCode),
	areaM2: areaM2(f.geometry),
	c: centroidOf(f.geometry).map((n) => +n.toFixed(4)),
}));
console.log(`[BUILDING-BLOCK] LSOA table:`, sizes(bbTable));
const perRow = JSON.stringify(bbTable).length / bbTable.length;
console.log(`  ~${perRow.toFixed(0)} bytes/row  ->  extrapolated OA (~230k): ${(perRow * 230000 / 1048576).toFixed(1)} MB raw`);

// --- real area-weighted crosswalk: constituency(2024) -> LAD(2025) via LSOA ---
console.log("\nDeriving constituency->LAD crosswalk (area-weighted via LSOA)...");
const conBox = con.map((f) => ({ code: getProp(f.properties, PROPERTY_KEYS.constituencyCode)!, bbox: bboxOf(f.geometry), geom: f.geometry }));
const ladBox = lad.map((f) => ({ code: getProp(f.properties, PROPERTY_KEYS.ladCode)!, bbox: bboxOf(f.geometry), geom: f.geometry }));
const inBox = (px: number, py: number, b: number[]) => px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3];
function assign(px: number, py: number, cand: { code: string; bbox: number[]; geom: GeoJSON.Geometry }[]): string | null {
	for (const c of cand) if (inBox(px, py, c.bbox) && pointInFeat(px, py, c.geom)) return c.code;
	return null;
}

// accum[con][lad] = summed LSOA area; and total per con
const accum: Record<string, Record<string, number>> = {};
let assigned = 0;
for (let i = 0; i < lsoa.length; i++) {
	const [px, py] = centroidOf(lsoa[i].geometry);
	const conCand = conBox.filter((c) => inBox(px, py, c.bbox));
	const ladCand = ladBox.filter((c) => inBox(px, py, c.bbox));
	const cc = assign(px, py, conCand);
	const lc = assign(px, py, ladCand);
	if (!cc || !lc) continue;
	const a = areaM2(lsoa[i].geometry);
	(accum[cc] ??= {})[lc] = (accum[cc][lc] ?? 0) + a;
	assigned++;
	if (i % 5000 === 0) process.stdout.write(`  ${i}/${lsoa.length}\r`);
}
console.log(`\n  assigned ${assigned}/${lsoa.length} LSOAs to both a constituency and a LAD`);

// build weighted crosswalk + validate weight sums
const crosswalk: Record<string, Array<{ code: string; weight: number }>> = {};
let sumErrors = 0, multiLad = 0;
for (const [c, lads] of Object.entries(accum)) {
	const total = Object.values(lads).reduce((s, v) => s + v, 0);
	const entries = Object.entries(lads).map(([lc, a]) => ({ code: lc, weight: +(a / total).toFixed(4) }));
	entries.sort((a, b) => b.weight - a.weight);
	crosswalk[c] = entries;
	if (entries.length > 1) multiLad++;
	const wsum = entries.reduce((s, e) => s + e.weight, 0);
	if (Math.abs(wsum - 1) > 0.01) sumErrors++;
}
console.log(`[CROSSWALK] constituency->LAD:`, sizes(crosswalk));
console.log(`  constituencies: ${Object.keys(crosswalk).length}, spanning >1 LAD: ${multiLad}`);
console.log(`  weight-sum invalid (|sum-1|>0.01): ${sumErrors}  (expect 0)`);
const sample = Object.entries(crosswalk).find(([, v]) => v.length > 2);
if (sample) console.log(`  sample ${sample[0]}:`, JSON.stringify(sample[1]));

console.log("\n=== SUMMARY (gzipped is what ships) ===");
console.log(`core (LAD+con)      : ${sizes(core).gzKB} KB gz`);
console.log(`con->LAD crosswalk  : ${sizes(crosswalk).gzKB} KB gz`);
console.log(`LSOA bb table       : ${sizes(bbTable).gzKB} KB gz  (build-time input)`);
