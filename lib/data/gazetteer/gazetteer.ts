// Runtime gazetteer API (design doc 7). Pure and synchronous over already-loaded
// artifacts; the hook (useGazetteer) handles loading/lifecycle. Supersedes
// LOCATIONS / areaBank / codeMapper as consumers migrate (Phase 3+).
import type { Crosswalk, GazetteerCore, GazetteerEntry, Level } from "./types";

const key = (from: Level, to: Level) => `${from}->${to}`;

export class Gazetteer {
	readonly version: number;
	private core: GazetteerCore;
	private crosswalks: Record<string, Crosswalk>;
	private childrenByParent: Record<string, string[]> = {};

	constructor(core: GazetteerCore, crosswalks: Record<string, Crosswalk> = {}) {
		this.core = core;
		this.crosswalks = crosswalks;
		this.version = core.version;
		// Invert parents once so descendants() is cheap.
		for (const e of Object.values(core.byCode))
			for (const p of e.parents)
				(this.childrenByParent[p] ??= []).push(e.code);
	}

	registerCrosswalk(from: Level, to: Level, cw: Crosswalk): void {
		this.crosswalks[key(from, to)] = cw;
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
		const entries = codes.map((c) => this.core.byCode[c]).filter(Boolean) as GazetteerEntry[];
		return level ? entries.filter((e) => e.level === level) : entries;
	}

	// --- named composite locations (replaces LOCATIONS) ---
	membersOf(named: string): string[] {
		return this.core.namedLocations[named]?.memberCodes ?? [];
	}
	boundsOf(named: string): [number, number, number, number] | undefined {
		return this.core.namedLocations[named]?.bbox;
	}
	namedLocations(): string[] {
		return Object.keys(this.core.namedLocations);
	}
	// Whole record for a named location (mirrors the old LOCATIONS[name]).
	namedLocation(named: string) {
		return this.core.namedLocations[named];
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
	overlaps(code: string, targetLevel: Level): Array<{ code: string; weight: number }> {
		const level = this.get(code)?.level;
		if (!level) return [];
		return this.crosswalks[key(level, targetLevel)]?.[code] ?? [];
	}

	// Weighted re-aggregation of extensive values from one level to another.
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
