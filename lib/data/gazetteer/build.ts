// Pure build functions: geometry features -> gazetteer artifacts.
import { getProp } from "../boundaries/properties";
import { areaM2, bboxOf, centroidOf, inBox, pointInGeom } from "./geometry";
import { SOURCED_DEFINITION_REVISION, type ResolvedPlace } from "./places";
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
	locations: Record<string, ResolvedPlace>,
	version: number,
): GazetteerCore {
	const byCode: Record<string, GazetteerEntry> = {};
	const nameIndex: Record<string, string[]> = {};

	for (const src of sources) {
		for (const f of src.features) {
			const code = getProp(f.properties, src.codeKeys);
			if (!code) continue;
			const name = getProp(f.properties, src.nameKeys) ?? "";
			const parent = src.parentKeys
				? getProp(f.properties, src.parentKeys)
				: undefined;
			byCode[code] = {
				code,
				name,
				level: src.level,
				vintage: src.vintage,
				areaM2: areaM2(f.geometry),
				bbox: bboxOf(f.geometry).map((n) => +n.toFixed(4)) as [
					number,
					number,
					number,
					number,
				],
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
		// An official area's members come from ONS, so its curated box may
		// miss one; widen it to cover every member it knows.
		const bbox = [...loc.bounds] as NamedLocation["bbox"];
		if (loc.source)
			for (const code of loc.lad_codes) {
				const member = byCode[code]?.bbox;
				if (!member) continue;
				bbox[0] = Math.min(bbox[0], member[0]);
				bbox[1] = Math.min(bbox[1], member[1]);
				bbox[2] = Math.max(bbox[2], member[2]);
				bbox[3] = Math.max(bbox[3], member[3]);
			}
		namedLocations[name] = {
			memberCodes: loc.lad_codes,
			bbox,
			kind: loc.kind,
			...(loc.source && {
				source: loc.source,
				definitionRevision: SOURCED_DEFINITION_REVISION,
			}),
		};
	}

	return { version, byCode, nameIndex, namedLocations };
}

// Weighted crosswalk from source areas to target areas, via a finer building
// block (e.g. LSOA / data zone). weight = share of the source's building-block
// measure that falls in each target: area by default, or residents for a
// population-weighted best fit.
export function buildCrosswalk(
	blocks: Feat[],
	sources: Feat[],
	sourceCodeKeys: readonly string[],
	targets: Feat[],
	targetCodeKeys: readonly string[],
	{
		measure = (block: Feat) => areaM2(block.geometry),
		onProgress,
	}: {
		measure?: (block: Feat) => number;
		onProgress?: (done: number, total: number) => void;
	} = {},
): { crosswalk: Crosswalk; assigned: number; total: number } {
	const index = (feats: Feat[], keys: readonly string[]) =>
		feats.map((f) => ({
			code: getProp(f.properties, keys)!,
			bbox: bboxOf(f.geometry),
			geom: f.geometry,
		}));
	const srcIdx = index(sources, sourceCodeKeys);
	const tgtIdx = index(targets, targetCodeKeys);

	const assign = (
		px: number,
		py: number,
		cand: typeof srcIdx,
	): string | null => {
		for (const c of cand)
			if (inBox(px, py, c.bbox) && pointInGeom(px, py, c.geom))
				return c.code;
		return null;
	};

	const accum: Record<string, Record<string, number>> = {};
	let assigned = 0;
	for (let i = 0; i < blocks.length; i++) {
		const [px, py] = centroidOf(blocks[i].geometry);
		const s = assign(
			px,
			py,
			srcIdx.filter((c) => inBox(px, py, c.bbox)),
		);
		const t = assign(
			px,
			py,
			tgtIdx.filter((c) => inBox(px, py, c.bbox)),
		);
		if (!s || !t) continue;
		const w = measure(blocks[i]);
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
