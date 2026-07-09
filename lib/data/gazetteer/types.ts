// Gazetteer artifact types. See docs/gazetteer-design.md.

export type Level =
	| "region"
	| "county"
	| "localAuthority"
	| "constituency"
	| "ward"
	| "lsoa"
	| "dataZone"
	| "superOutputArea";

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
	bbox: [number, number, number, number];
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
