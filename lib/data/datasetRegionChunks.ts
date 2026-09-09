import { gazetteer } from "./gazetteer/static";

export const REGION_CHUNK_KEYS = [
	"E12000001",
	"E12000002",
	"E12000003",
	"E12000004",
	"E12000005",
	"E12000006",
	"E12000007",
	"E12000008",
	"E12000009",
	"Scotland",
	"Wales",
	"Northern Ireland",
] as const;

export type RegionChunkKey = (typeof REGION_CHUNK_KEYS)[number];

const COUNTRY_CHUNKS: Record<string, readonly RegionChunkKey[]> = {
	England: REGION_CHUNK_KEYS.slice(0, 9),
	Scotland: ["Scotland"],
	Wales: ["Wales"],
	"Northern Ireland": ["Northern Ireland"],
	"United Kingdom": REGION_CHUNK_KEYS,
};

const regionForLad = (code: string): RegionChunkKey | null => {
	const region = gazetteer
		.ancestors(code)
		.find((entry) => entry.level === "region")?.code;
	if (region && REGION_CHUNK_KEYS.includes(region as RegionChunkKey))
		return region as RegionChunkKey;
	if (code.startsWith("S")) return "Scotland";
	if (code.startsWith("W")) return "Wales";
	if (code.startsWith("N")) return "Northern Ireland";
	return null;
};

/**
 * Region chunks are an efficient first fetch for the named location. The
 * worker then applies the exact LAD/overlap filter before returning records to
 * the UI. Returning null keeps an unknown or legacy location on the safe full
 * payload fallback.
 */
export const regionChunksForLocation = (
	location: string,
): readonly RegionChunkKey[] | null => {
	const countryChunks = COUNTRY_CHUNKS[location];
	if (countryChunks) return countryChunks;

	const members = gazetteer.namedLocation(location)?.memberCodes;
	if (!members?.length) return null;
	const regions = new Set<RegionChunkKey>();
	for (const member of members) {
		const region = regionForLad(member);
		if (!region) return null;
		regions.add(region);
	}
	return regions.size > 0 ? [...regions] : null;
};

export const regionChunkPath = (precompiledFile: string, region: string) =>
	`/data/precompiled/chunks/${precompiledFile}/${region}.json`;
