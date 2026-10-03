// Runtime gazetteer API (design doc 7). Pure and synchronous over already-loaded
// artifacts, which are passed in whole at construction. Supersedes
// LOCATIONS / areaBank / codeMapper as consumers migrate (Phase 3+).
import type {
	Crosswalk,
	GazetteerCore,
	GazetteerEntry,
	Level,
	NamedLocation,
} from "./types";

const key = (from: Level, to: Level) => `${from}->${to}`;

/**
 * Each current local authority as a place of its own, so the atlas can open
 * on any council. One a named location already stands for, by name or by
 * being that single authority, is left to it.
 */
function councilPlaces(core: GazetteerCore): Record<string, NamedLocation> {
	const named = Object.entries(core.namedLocations);
	const namedNames = new Set(named.map(([name]) => name));
	const namedCouncils = new Set(
		named
			.filter(([, place]) => place.memberCodes.length === 1)
			.map(([, place]) => place.memberCodes[0]),
	);
	const councils = Object.values(core.byCode).filter(
		(entry) => entry.level === "localAuthority",
	);
	const current = Math.max(...councils.map((entry) => entry.vintage));
	const places: Record<string, NamedLocation> = {};
	for (const council of councils) {
		if (council.vintage !== current || namedCouncils.has(council.code))
			continue;
		// "Bristol, City of" reads as "Bristol".
		const name = council.name.replace(/, (City|County) of$/, "");
		if (namedNames.has(name) || namedNames.has(council.name)) continue;
		places[name] = {
			memberCodes: [council.code],
			bbox: council.bbox,
			kind: "local-authority",
		};
	}
	return places;
}

export class Gazetteer {
	readonly version: number;
	private core: GazetteerCore;
	private crosswalks: Record<string, Crosswalk>;
	private childrenByParent: Record<string, string[]> = {};
	/** Named locations, then the councils none of them stands for. */
	private placesByName: Record<string, NamedLocation>;

	constructor(
		core: GazetteerCore,
		crosswalks: Record<string, Crosswalk> = {},
	) {
		this.core = core;
		this.crosswalks = crosswalks;
		this.version = core.version;
		this.placesByName = { ...councilPlaces(core), ...core.namedLocations };
		// Invert parents once so descendants() is cheap.
		for (const e of Object.values(core.byCode))
			for (const p of e.parents)
				(this.childrenByParent[p] ??= []).push(e.code);
	}

	// --- identity / attributes ---
	get(code: string): GazetteerEntry | undefined {
		return this.core.byCode[code];
	}
	areaM2(code: string): number | undefined {
		return this.core.byCode[code]?.areaM2;
	}
	bboxOf(code: string): [number, number, number, number] | undefined {
		return this.core.byCode[code]?.bbox;
	}

	// --- names (alias-aware, ambiguity-preserving; see 4.6) ---
	resolveName(name: string, level?: Level): GazetteerEntry[] {
		const codes = this.core.nameIndex[name.trim().toLowerCase()] ?? [];
		const entries = codes
			.map((c) => this.core.byCode[c])
			.filter(Boolean) as GazetteerEntry[];
		return level ? entries.filter((e) => e.level === level) : entries;
	}

	// --- named composite locations (replaces LOCATIONS) ---
	// A council place resolves here too, so the atlas can open on it.
	membersOf(named: string): string[] {
		return this.placesByName[named]?.memberCodes ?? [];
	}
	boundsOf(named: string): [number, number, number, number] | undefined {
		return this.placesByName[named]?.bbox;
	}
	/** The curated places: regions, counties, cities and groupings. */
	namedLocations(): string[] {
		return Object.keys(this.core.namedLocations);
	}
	/** Every place: the curated ones, then the councils. */
	places(): string[] {
		return [...this.namedLocations(), ...this.councilLocations()];
	}
	/** Current local authorities that are places of their own. */
	councilLocations(): string[] {
		return Object.keys(this.placesByName).filter(
			(name) => !(name in this.core.namedLocations),
		);
	}
	// Whole record for a named location (mirrors the old LOCATIONS[name]).
	namedLocation(named: string) {
		return this.placesByName[named];
	}

	// --- clean-nesting hierarchy (empty until parents are populated) ---
	ancestors(code: string): GazetteerEntry[] {
		const out: GazetteerEntry[] = [];
		const seen = new Set<string>();
		let frontier = this.get(code)?.parents ?? [];
		while (frontier.length) {
			const next: string[] = [];
			for (const p of frontier) {
				if (seen.has(p)) continue;
				seen.add(p);
				const e = this.get(p);
				if (e) {
					out.push(e);
					next.push(...e.parents);
				}
			}
			frontier = next;
		}
		return out;
	}

	// Direct children, optionally filtered to a level (e.g. region -> its LADs).
	descendants(code: string, level?: Level): GazetteerEntry[] {
		const kids = (this.childrenByParent[code] ?? [])
			.map((c) => this.core.byCode[c])
			.filter(Boolean) as GazetteerEntry[];
		return level ? kids.filter((e) => e.level === level) : kids;
	}

	// --- conversions (see 4.4) ---
	overlaps(
		code: string,
		targetLevel: Level,
	): Array<{ code: string; weight: number }> {
		const level = this.get(code)?.level;
		if (!level) return [];
		return this.crosswalks[key(level, targetLevel)]?.[code] ?? [];
	}

	/**
	 * Weighted re-aggregation of extensive values (counts that add over areas)
	 * from one level to another. Wrong for anything else: a rate, share or
	 * median must be apportioned as numerator and denominator, or not at all.
	 * Which kind a measure is belongs to the API, whose data catalogue declares
	 * it for every measure it serves (`aggregation.kind` in services/api/src/dataCatalog.ts);
	 * check that before calling this on a dataset's values.
	 */
	apportion(
		values: Record<string, number>,
		fromLevel: Level,
		targetLevel: Level,
	): Record<string, number> {
		const cw = this.crosswalks[key(fromLevel, targetLevel)];
		const out: Record<string, number> = {};
		if (!cw) return out;
		for (const [src, v] of Object.entries(values)) {
			for (const { code, weight } of cw[src] ?? []) {
				out[code] = (out[code] ?? 0) + v * weight;
			}
		}
		return out;
	}
}
