import {
	ATLAS_LOCATIONS,
	type AtlasLocation,
	type AtlasMap,
	findAtlasLocation,
} from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import {
	areasWithin,
	COUNCIL_PLACES,
	RANKED_MAPS,
	rankingSource,
} from "@/lib/atlas/rankings";
import type { RankingLevel } from "@/lib/atlas/rankingRecipes";
import type { PlaceGeography } from "@/lib/places/profile";

/**
 * Where a place stands in each ranking it is in, for its /places page: a
 * council or constituency among its region's, or its nation's outside
 * England, and a ward among its council's. Each links to the ranking's page.
 */

export type PlaceRanking = {
	map: AtlasMap;
	value: number;
	rank: number;
	of: number;
	/** The place the ranking is within, with a ranking page of its own. */
	group: AtlasLocation;
};

const LEVELS: Readonly<Record<PlaceGeography, RankingLevel>> = {
	localAuthority: "localAuthority",
	ward: "ward",
	constituency: "constituency",
};

const NATIONS: Readonly<Record<string, string>> = {
	E: "england",
	W: "wales",
	S: "scotland",
	N: "northern-ireland",
};

/** Each current council's English region, as a place. */
const REGIONS: ReadonlyMap<string, AtlasLocation> = new Map(
	ATLAS_LOCATIONS.filter((location) => location.kind === "region").flatMap(
		(location) => location.members.map((code) => [code, location] as const),
	),
);

/** The places to rank an area within, closest first. */
function groupsFor(level: RankingLevel, district: string): AtlasLocation[] {
	const nation = findAtlasLocation(NATIONS[district[0] ?? ""] ?? "");
	const groups =
		level === "ward"
			? [COUNCIL_PLACES.get(district)]
			: [REGIONS.get(district), nation];
	return groups.filter((group) => group !== undefined);
}

/** A place's position in every ranking of its geography that holds it. */
export async function placeRankings(
	code: string,
	geography: PlaceGeography,
): Promise<PlaceRanking[]> {
	const level = LEVELS[geography];
	const maps = RANKED_MAPS.filter(
		(map) => rankingSource(map)?.level === level,
	);
	const rankings = await Promise.all(
		maps.map(async (map): Promise<PlaceRanking | null> => {
			const ranking = await loadRanking(map.slug);
			const area = ranking.areas.find(
				(candidate) => candidate.code === code,
			);
			if (!area) return null;
			for (const group of groupsFor(level, area.district)) {
				if (!hasRankingFor(group.slug, map.slug)) continue;
				const areas = areasWithin(ranking, group);
				const index = areas.indexOf(area);
				if (index < 0) continue;
				return {
					map,
					value: area.value,
					rank: index + 1,
					of: areas.length,
					group,
				};
			}
			return null;
		}),
	);
	return rankings.filter((ranking) => ranking !== null);
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(rank: number) {
	const tens = rank % 100;
	if (tens >= 11 && tens <= 13) return `${rank}th`;
	return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
}

/** "Highest", "3rd highest", "2nd lowest", "Lowest": a rank read from its nearer end. */
export function standing(rank: number, of: number) {
	if (rank === 1) return "Highest";
	if (rank === of) return "Lowest";
	return rank * 2 <= of + 1
		? `${ordinal(rank)} highest`
		: `${ordinal(of - rank + 1)} lowest`;
}
