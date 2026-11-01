import { readAtlasPage } from "@/lib/helpers/atlasPages";
import {
	isAreaCode,
	placeShard,
	type AreaProfile,
	type NamedProfile,
	type NamedRef,
	type PlaceIndex,
	type PlaceIndexEntry,
} from "@uk-data-atlas/catalogue/place-profile";

export const loadPlaceIndex = () => readAtlasPage<PlaceIndex>("places-index");
const readProfiles = (path: string) =>
	readAtlasPage<unknown>(
		`places-${path
			.replace("areas/", "area-")
			.replace("named/", "named-")
			.replace(/\.json$/, "")}`,
	);

/** A place's index row, by area code or named place id. */
export async function placeEntry(
	id: string,
): Promise<PlaceIndexEntry | undefined> {
	const index = await loadPlaceIndex();
	return (isAreaCode(id) ? index.areas : index.named).find(
		(entry) => entry[0] === id,
	);
}

/** An area's profile from its shard. */
export async function loadAreaProfile(
	code: string,
): Promise<AreaProfile | undefined> {
	if (!(await placeEntry(code))) return undefined;
	const shard = (await readProfiles(
		`areas/${placeShard(code)}.json`,
	)) as Record<string, AreaProfile>;
	return shard[code];
}

export async function loadNamedProfile(
	id: string,
): Promise<NamedProfile | undefined> {
	if (!(await placeEntry(id))) return undefined;
	return (await readProfiles(`named/${id}.json`)) as NamedProfile;
}

/** Several areas' profiles, reading each shard once. */
export async function loadAreaProfiles(
	codes: string[],
): Promise<Map<string, AreaProfile>> {
	const shards = new Map<string, Promise<Record<string, AreaProfile>>>();
	const profiles = new Map<string, AreaProfile>();
	const index = await loadPlaceIndex();
	const codesInIndex = new Set(index.areas.map(([code]) => code));
	await Promise.all(
		codes
			.filter((code) => codesInIndex.has(code))
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
const currentAreas = async () =>
	(await loadPlaceIndex()).areas.filter(
		([, , geography, , , lastYear]) =>
			geography !== "ward" && lastYear === null,
	);

const resolvePlaceRegions = async (): Promise<Map<string, string>> => {
	const current = await currentAreas();
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

/** The region lookup shared by the places directory and place pages. */
export const placeRegions = resolvePlaceRegions;
