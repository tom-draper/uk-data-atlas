// Pure build functions: geometry features -> gazetteer artifacts.
import { getProp } from "../boundaries/properties";
import { areaM2, bboxOf } from "./geometry";
import { SOURCED_DEFINITION_REVISION, type ResolvedPlace } from "./places";
import type {
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
			...(loc.memberValidity && {
				memberAssertions: loc.lad_codes.map((code) => ({
					code,
					...loc.memberValidity?.[code],
				})),
			}),
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
