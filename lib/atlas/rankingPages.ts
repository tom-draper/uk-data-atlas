import rankingPages from "@/public/data/datasets/ranking-pages.json";
import type { MapRanking } from "@/lib/atlas/rankings";

const PAGES = rankingPages as Record<string, string[]>;

/** Whether a place has a page ranking its areas on a map. */
export const hasRankingFor = (locationSlug: string, mapSlug: string) =>
	PAGES[mapSlug]?.includes(locationSlug) ?? false;

/** Every ranking page, as place and map slugs. */
export const RANKING_PAGES = Object.entries(PAGES).flatMap(([map, places]) =>
	places.map((location) => ({ location, map })),
);

/** A map's ranked areas, read only when a page for it renders. */
export async function loadRanking(mapSlug: string): Promise<MapRanking> {
	const ranking = await import(
		`@/public/data/datasets/rankings/${mapSlug}.json`
	);
	return ranking.default as MapRanking;
}
