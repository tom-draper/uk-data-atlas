import { readFile } from "node:fs/promises";
import { join } from "node:path";
import placeIndex from "@/public/data/datasets/places/index.json";
import {
	isAreaCode,
	placeShard,
	type AreaProfile,
	type NamedProfile,
	type PlaceIndex,
	type PlaceIndexEntry,
} from "@/lib/places/profile";

export const PLACE_INDEX = placeIndex as unknown as PlaceIndex;

// Read from disk rather than imported: bundling 50 MB of profiles would slow
// every build. next.config.ts traces the folder into the /places function.
const PROFILES = join(process.cwd(), "public", "data", "datasets", "places");

const readProfiles = async (path: string) =>
	JSON.parse(await readFile(join(PROFILES, path), "utf8")) as unknown;

const areaEntries = new Map(
	PLACE_INDEX.areas.map((entry) => [entry[0], entry]),
);
const namedEntries = new Map(
	PLACE_INDEX.named.map((entry) => [entry[0], entry]),
);

/** A place's index row, by area code or named place id. */
export function placeEntry(id: string): PlaceIndexEntry | undefined {
	return isAreaCode(id) ? areaEntries.get(id) : namedEntries.get(id);
}

/** An area's profile, read from its shard only when a page for it renders. */
export async function loadAreaProfile(
	code: string,
): Promise<AreaProfile | undefined> {
	if (!areaEntries.has(code)) return undefined;
	const shard = (await readProfiles(
		`areas/${placeShard(code)}.json`,
	)) as Record<string, AreaProfile>;
	return shard[code];
}

export async function loadNamedProfile(
	id: string,
): Promise<NamedProfile | undefined> {
	if (!namedEntries.has(id)) return undefined;
	return (await readProfiles(`named/${id}.json`)) as NamedProfile;
}
