import { notFound } from "next/navigation";
import {
	type AtlasLocation,
	type AtlasMap,
	findAtlasLocation,
	findAtlasMap,
} from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import {
	areasWithin,
	COUNCIL_PLACES,
	formatColumnValue,
	formatRankedValue,
	type MapRanking,
	type RankedArea,
} from "@/lib/atlas/rankings";
import { gazetteer } from "@/lib/data/gazetteer/static";

/** A ranked area as its table row reads, formatted on the server. */
export type RankingRow = {
	rank: number;
	code: string;
	name: string;
	/** The page the name links to, where the area has one. */
	href?: string;
	/** The council a ward sits in. */
	note?: string;
	value: string;
	extra: string[];
};

/**
 * The rows a long ranking renders with its page. The rest load when asked
 * for, so a page of every ward stays small enough to read and to index.
 */
export const SERVER_ROWS = 100;

/** Rankings this long render only their first rows with the page. */
export const LONG_RANKING = 400;

export async function resolveRanking(params: {
	location: string;
	map: string;
}) {
	const location = findAtlasLocation(params.location);
	const map = findAtlasMap(params.map);
	if (!location || !map || !hasRankingFor(location.slug, map.slug))
		notFound();
	const ranking = await loadRanking(map.slug);
	const areas = areasWithin(ranking, location);
	return { location, map, ranking, areas };
}

export function rankingRow(
	location: AtlasLocation,
	map: AtlasMap,
	ranking: MapRanking,
	area: RankedArea,
	index: number,
): RankingRow {
	const council = COUNCIL_PLACES.get(area.district);
	const row: RankingRow = {
		rank: index + 1,
		code: area.code,
		name: area.name,
		value: formatRankedValue(map, area.value),
		extra: (ranking.columns ?? []).map((column, index) =>
			formatColumnValue(column, area.extra?.[index]),
		),
	};
	// A council's own page need not name it against each of its wards.
	if (ranking.level === "ward" && location.members.length !== 1) {
		const note = council?.name ?? gazetteer.get(area.district)?.name;
		if (note) row.note = note;
	} else if (ranking.level === "constituency") {
		// Constituencies have place pages of their own.
		row.href = `/places/${area.code}`;
	} else if (council && area.code === area.district) {
		// A council links to its maps; a former council's row names it, not
		// its successor.
		row.href = `/maps/${council.slug}`;
	}
	return row;
}

/** Whether a ranking's page renders only its first rows. */
export const isLongRanking = (areas: readonly RankedArea[]) =>
	areas.length > LONG_RANKING;
