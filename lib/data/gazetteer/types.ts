// Gazetteer artifact types. See docs/gazetteer-design.md.
import type { PlaceKind, PlaceSource } from "./places";

// The levels the core holds and crosswalks join. Finer levels stay with the
// boundary mappings and match index, and counties are named locations
// (docs/gazetteer-design.md 9.7).
export type Level = "region" | "localAuthority" | "constituency";

export interface GazetteerEntry {
	code: string;
	name: string;
	level: Level;
	vintage: number;
	areaM2: number;
	bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
	parents: string[]; // clean-nesting parents only (see 4.1 / 4.4)
}

export interface NamedLocation {
	memberCodes: string[];
	/** Effective intervals for members whose code set has changed over time. */
	memberAssertions?: Array<{
		code: string;
		validFrom?: string;
		validTo?: string;
	}>;
	bbox: [number, number, number, number];
	/** An official area, or an editorial grouping (see ./places.ts). */
	kind: PlaceKind;
	/** The ONS lookup an official area's current members come from. */
	source?: PlaceSource;
	/** Set when the definition has been revised since the gazetteer version. */
	definitionRevision?: number;
}

// The eager core artifact (gazetteer.core.json). Coarse levels + indexes.
export interface GazetteerCore {
	version: number;
	byCode: Record<string, GazetteerEntry>;
	nameIndex: Record<string, string[]>; // lowercased name/alias -> codes
	namedLocations: Record<string, NamedLocation>; // replaces LOCATIONS
}

// A weighted crosswalk shard (crosswalk.<from>-<to>.json). See 4.4.
export type Crosswalk = Record<
	string, // source code
	Array<{ code: string; weight: number }> // targets + share of source
>;
