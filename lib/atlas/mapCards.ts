import figures from "@/public/data/datasets/map-figures.json";
import type { MapFigures } from "@/lib/atlas/figures";
import type { AtlasLocation, AtlasMap } from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import {
	loadPlaceCodes,
	type RankingRow,
	rankingRow,
} from "@/lib/atlas/rankingRows";
import { areasWithin } from "@/lib/atlas/rankings";
import { atlasMapFigure } from "@/lib/atlas/snippets";

/** A first sentence longer than this ends at its first clause. */
const LONG_SENTENCE = 100;

/**
 * A description's first sentence: what a map shows. The notes after it, on
 * editions, methods and gaps, belong on the map's own pages.
 */
export function firstSentence(text: string) {
	const trimmed = text.trim();
	const sentence = /^(.+?[.!?])\s+(?=[A-Z0-9])/.exec(trimmed)?.[1] ?? trimmed;
	if (sentence.length <= LONG_SENTENCE) return sentence;
	const clause = /^(.+?)[,;]\s/.exec(sentence)?.[1];
	return clause ? `${clause}.` : sentence;
}

/** A place's highest and lowest areas on a map, where it has a ranking. */
export async function rankingExtremes(
	location: AtlasLocation,
	map: AtlasMap,
): Promise<{ highest: RankingRow; lowest: RankingRow } | null> {
	if (!hasRankingFor(location.slug, map.slug)) return null;
	const [ranking, places] = await Promise.all([
		loadRanking(map.slug),
		loadPlaceCodes(),
	]);
	const areas = areasWithin(ranking, location);
	if (areas.length < 2) return null;
	const context = { location, map, ranking, places };
	const last = areas.length - 1;
	return {
		highest: rankingRow(context, areas[0]!, 0),
		lowest: rankingRow(context, areas[last]!, last),
	};
}

/**
 * What a map's card on a place's index says: the place's headline figure, or
 * else what the map shows. A figure giving the range across the place's areas
 * would repeat the card's highest and lowest, so those cards say what the map
 * shows instead.
 */
export function mapCardSentence(
	location: AtlasLocation,
	map: AtlasMap,
	ranked: boolean,
) {
	const kind = (figures as unknown as MapFigures)[map.slug]?.[location.slug]
		?.kind;
	const figure =
		ranked && kind === "range" ? null : atlasMapFigure(location, map);
	return figure ?? firstSentence(map.source.description);
}
