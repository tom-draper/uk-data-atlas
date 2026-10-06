import { readFile } from "node:fs/promises";
import { join } from "node:path";
import placeIndex from "@/public/data/datasets/places/index.json";
import {
	isAreaCode,
	placeShard,
	type AreaProfile,
	type NamedProfile,
	type NamedRef,
	type PlaceIndex,
	type PlaceIndexEntry,
} from "@/lib/places/profile";

export const PLACE_INDEX = placeIndex as unknown as PlaceIndex;

// Read from disk rather than imported: bundling 50 MB of profiles would slow
// every build. next.config.ts traces the folder into the /places function.
const PROFILES = join(process.cwd(), "public", "data", "datasets", "places");

/** Profile shards already read by this server instance. */
const profileReads = new Map<string, Promise<unknown>>();

const readProfiles = (path: string) => {
	let read = profileReads.get(path);
	if (!read) {
		read = readFile(join(PROFILES, path), "utf8").then(JSON.parse);
		profileReads.set(path, read);
	}
	return read;
};

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

/** Several areas' profiles, reading each shard once. */
export async function loadAreaProfiles(
	codes: string[],
): Promise<Map<string, AreaProfile>> {
	const shards = new Map<string, Promise<Record<string, AreaProfile>>>();
	const profiles = new Map<string, AreaProfile>();
	await Promise.all(
		codes
			.filter((code) => areaEntries.has(code))
			.map(async (code) => {
				const shard = placeShard(code);
				if (!shards.has(shard))
					shards.set(
						shard,
						readProfiles(`areas/${shard}.json`) as Promise<
							Record<string, AreaProfile>
						>,
					);
				const profile = (await shards.get(shard)!)[code];
				if (profile) profiles.set(code, profile);
			}),
	);
	return profiles;
}

/** The English regions, then the nations without them, north to south. */
export const PLACE_REGIONS: NamedRef[] = [
	["north-east", "North East"],
	["north-west", "North West"],
	["yorkshire", "Yorkshire and the Humber"],
	["east-midlands", "East Midlands"],
	["west-midlands", "West Midlands"],
	["east-of-england", "East of England"],
	["london", "London"],
	["south-east", "South East"],
	["south-west", "South West"],
	["wales", "Wales"],
	["scotland", "Scotland"],
	["northern-ireland", "Northern Ireland"],
].map(([id, label]) => ({
	id: id!,
	label: label!,
	kind: ["wales", "scotland", "northern-ireland"].includes(id!)
		? "country"
		: "region",
}));

const NATION_REGION: Record<string, string> = {
	W: "wales",
	S: "scotland",
	N: "northern-ireland",
};

/**
 * The region of each current local authority and constituency, or its nation
 * outside England. A constituency takes the region of a council it sits in
 * or overlaps; English regions don't cross council lines.
 */
const currentAreas = () =>
	PLACE_INDEX.areas.filter(
		([, , geography, , , lastYear]) =>
			geography !== "ward" && lastYear === null,
	);

const resolvePlaceRegions = async (): Promise<Map<string, string>> => {
	const current = currentAreas();
	const profiles = await loadAreaProfiles(current.map(([code]) => code));
	const regions = new Map<string, string>();
	const regionOf = (code: string) =>
		NATION_REGION[code[0] ?? ""] ??
		profiles
			.get(code)
			?.namedPlaces?.find((place) => place.kind === "region")?.id;
	for (const [code, , geography] of current) {
		if (geography !== "localAuthority") continue;
		const region = regionOf(code);
		if (region) regions.set(code, region);
	}
	for (const [code, , geography] of current) {
		if (geography !== "constituency") continue;
		const profile = profiles.get(code);
		const councils = [
			...(profile?.parents ?? []),
			...(profile?.overlaps.flatMap((group) => group.areas ?? []) ?? []),
		].filter((area) => area.geography === "localAuthority");
		const region =
			NATION_REGION[code[0] ?? ""] ??
			councils
				.map((council) => regions.get(council.code))
				.find((found) => found !== undefined);
		if (region) regions.set(code, region);
	}
	return regions;
};

let regions: Promise<Map<string, string>> | undefined;

/** The region lookup shared by the places index and all place pages. */
export const placeRegions = () => (regions ??= resolvePlaceRegions());

/**
 * Read the place-index shards the directory uses before the server accepts
 * traffic. The reads stay cached for the instance, so `/places` does not pay
 * the first-request disk and JSON cost.
 */
export const warmPlacesDirectory = async () => {
	const current = currentAreas();
	await Promise.all([
		placeRegions(),
		loadAreaProfiles(
			current
				.filter(([, , geography]) => geography === "localAuthority")
				.map(([code]) => code),
		),
	]);
};
