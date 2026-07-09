// Pure build functions: geometry features -> gazetteer artifacts.
import { getProp } from "../boundaries/boundaries";
import { areaM2, bboxOf, centroidOf, inBox, pointInGeom } from "./geometry";
import type {
	Crosswalk,
	GazetteerCore,
	GazetteerEntry,
	Level,
	NamedLocation,
} from "./types";

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

export interface LevelSource {
	level: Level;
	vintage: number;
	features: Feat[];
	codeKeys: readonly string[];
	nameKeys: readonly string[];
	parentKeys?: readonly string[]; // e.g. ward -> LAD code, when in props
}

export function buildCore(
	sources: LevelSource[],
	locations: Record<string, { lad_codes: string[]; bounds: [number, number, number, number] }>,
	version: number,
): GazetteerCore {
	const byCode: Record<string, GazetteerEntry> = {};
	const nameIndex: Record<string, string[]> = {};

	for (const src of sources) {
		for (const f of src.features) {
			const code = getProp(f.properties, src.codeKeys);
			if (!code) continue;
			const name = getProp(f.properties, src.nameKeys) ?? "";
			const parent = src.parentKeys ? getProp(f.properties, src.parentKeys) : undefined;
			byCode[code] = {
				code,
				name,
				level: src.level,
				vintage: src.vintage,
				areaM2: areaM2(f.geometry),
				bbox: bboxOf(f.geometry).map((n) => +n.toFixed(4)) as [number, number, number, number],
				parents: parent ? [parent] : [],
			};
			if (name) {
				const key = name.toLowerCase();
				const list = (nameIndex[key] ??= []);
				if (!list.includes(code)) list.push(code);
			}
		}
	}

	const namedLocations: Record<string, NamedLocation> = {};
	for (const [name, loc] of Object.entries(locations)) {
		namedLocations[name] = { memberCodes: loc.lad_codes, bbox: loc.bounds };
	}

	return { version, byCode, nameIndex, namedLocations };
}

// Synthesises region-level entries and sets each member LAD's parent to its
// region. Regions have no geometry file here, so areaM2 is summed from member
// LADs and bbox is their union. Derived from LOCATIONS region membership, which
// the app already trusts.
export function linkRegions(
	core: GazetteerCore,
	regions: Array<{ code: string; name: string; memberCodes: string[] }>,
): void {
	for (const r of regions) {
		let areaM2 = 0;
		let minX = 180, minY = 90, maxX = -180, maxY = -90;
		const present: string[] = [];
		for (const lad of r.memberCodes) {
			const e = core.byCode[lad];
			if (!e) continue; // skip pre-2016 stale codes (LOCATIONS debt)
			present.push(lad);
			e.parents = [r.code];
			areaM2 += e.areaM2;
			minX = Math.min(minX, e.bbox[0]);
			minY = Math.min(minY, e.bbox[1]);
			maxX = Math.max(maxX, e.bbox[2]);
			maxY = Math.max(maxY, e.bbox[3]);
		}
		if (present.length === 0) continue;
		core.byCode[r.code] = {
			code: r.code,
			name: r.name,
			level: "region",
			vintage: 0,
			areaM2,
			bbox: [minX, minY, maxX, maxY],
			parents: [],
		};
		const nk = r.name.toLowerCase();
		const list = (core.nameIndex[nk] ??= []);
		if (!list.includes(r.code)) list.push(r.code);
	}
}

// Weighted crosswalk from source areas to target areas, via a finer building
// block (e.g. LSOA / ward). weight = share of source's building-block measure
// (area here; swap for population for best-fit) that falls in each target.
export function buildCrosswalk(
	blocks: Feat[],
	sources: Feat[],
	sourceCodeKeys: readonly string[],
	targets: Feat[],
	targetCodeKeys: readonly string[],
	onProgress?: (done: number, total: number) => void,
): { crosswalk: Crosswalk; assigned: number; total: number } {
	const index = (feats: Feat[], keys: readonly string[]) =>
		feats.map((f) => ({
			code: getProp(f.properties, keys)!,
			bbox: bboxOf(f.geometry),
			geom: f.geometry,
		}));
	const srcIdx = index(sources, sourceCodeKeys);
	const tgtIdx = index(targets, targetCodeKeys);

	const assign = (px: number, py: number, cand: typeof srcIdx): string | null => {
		for (const c of cand) if (inBox(px, py, c.bbox) && pointInGeom(px, py, c.geom)) return c.code;
		return null;
	};

	const accum: Record<string, Record<string, number>> = {};
	let assigned = 0;
	for (let i = 0; i < blocks.length; i++) {
		const [px, py] = centroidOf(blocks[i].geometry);
		const s = assign(px, py, srcIdx.filter((c) => inBox(px, py, c.bbox)));
		const t = assign(px, py, tgtIdx.filter((c) => inBox(px, py, c.bbox)));
		if (!s || !t) continue;
		const w = areaM2(blocks[i].geometry);
		(accum[s] ??= {})[t] = (accum[s][t] ?? 0) + w;
		assigned++;
		if (onProgress && i % 5000 === 0) onProgress(i, blocks.length);
	}

	const crosswalk: Crosswalk = {};
	for (const [s, tgts] of Object.entries(accum)) {
		const total = Object.values(tgts).reduce((a, b) => a + b, 0);
		crosswalk[s] = Object.entries(tgts)
			.map(([code, a]) => ({ code, weight: +(a / total).toFixed(4) }))
			.sort((a, b) => b.weight - a.weight);
	}
	return { crosswalk, assigned, total: blocks.length };
}
