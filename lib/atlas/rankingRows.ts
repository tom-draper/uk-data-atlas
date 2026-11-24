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
import { loadPlaceIndex } from "@/lib/places/load";

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
	/** What each value column sorts by: the value, then the extra columns. */
	keys: (number | string | null)[];
};

/** What a ranking's rows are built from. */
export type RankingContext = {
	location: AtlasLocation;
	map: AtlasMap;
	ranking: MapRanking;
	/** The areas with a place page of their own. */
	places: ReadonlySet<string>;
};

let placeCodes: Promise<ReadonlySet<string>> | undefined;
const loadPlaceCodes = () =>
	(placeCodes ??= loadPlaceIndex().then(
		(index) => new Set(index.areas.map(([code]) => code)),
	));

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
	const [ranking, places] = await Promise.all([
		loadRanking(map.slug),
		loadPlaceCodes(),
	]);
	const areas = areasWithin(ranking, location);
	return { location, map, ranking, places, areas };
}

export function rankingRow(
	{ location, map, ranking, places }: RankingContext,
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
		keys: [
			area.value,
			...(ranking.columns ?? []).map(
				(_, index) => area.extra?.[index] ?? null,
			),
		],
	};
	// A council's own page need not name it against each of its wards.
	if (ranking.level === "ward" && location.members.length !== 1) {
		const note = council?.name ?? gazetteer.get(area.district)?.name;
		if (note) row.note = note;
	}
	if (places.has(area.code)) row.href = `/places/${area.code}`;
	else if (council && area.code === area.district)
		// A council with no place page of its own links to its maps.
		row.href = `/maps/${council.slug}`;
	return row;
}

/**
 * The value that fills a row's bar: the largest. Bars start at zero, so a
 * ranking with negative values has none, and nor does one whose values all
 * sit close together (life expectancy, say), where every bar would look full.
 */
export const barScale = (areas: readonly RankedArea[]) => {
	let [smallest, largest] = [Infinity, 0];
	for (const { value } of areas) {
		if (value < 0) return null;
		smallest = Math.min(smallest, value);
		largest = Math.max(largest, value);
	}
	return largest > 0 && smallest <= largest / 2 ? largest : null;
};

/** Whether a ranking's page renders only its first rows. */
export const isLongRanking = (areas: readonly RankedArea[]) =>
	areas.length > LONG_RANKING;
