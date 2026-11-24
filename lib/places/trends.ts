import { readAtlasPage } from "@/lib/helpers/atlasPages";
import { atlasMapTitle, findAtlasMap } from "@/lib/atlas/pages";
import { COUNCIL_PLACES } from "@/lib/atlas/rankings";
import { hasRankingFor } from "@/lib/atlas/rankingPages";
import { loadPlaceIndex } from "@/lib/places/load";
import { rankPhrase } from "@/lib/places/headlines";
import {
	trendKind,
	trendStanding,
	type PlaceTrendArea,
	type PlaceTrendKind,
	type PlaceTrends,
	type TrendStanding,
} from "@uk-data-atlas/catalogue/place-trends";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import { formatDisplay } from "@/lib/datasets/declared";

export * from "@uk-data-atlas/catalogue/place-trends";

/**
 * A place page's series on its current boundary, from the place-trends page
 * the atlas-pages stage compiles. Each is declared by the datasets that
 * publish it, so a new one needs no change here.
 */

export type PlaceTrendView = {
	key: string;
	label: string;
	area: PlaceTrendArea;
	/** "mid-2024" for the period "2024". */
	periodName: (period: string) => string;
	/** A value as the page writes it, such as "£34,500" or "81.2 years". */
	format: (value: number) => string;
	/** How the change since the first period reads. */
	change: "percent" | "difference";
	/** The latest value, as published. */
	latest: { period: string; value: number; kind: PlaceTrendKind };
	/** The latest value rounded for prose, such as "275,000". */
	rounded: string;
	source: {
		name: string;
		publisher: string;
		edition: string;
		url: string;
		licence: string;
		licenceUrl: string;
	};
	standing?: TrendStanding & {
		phrase: string;
		names: Record<string, string>;
	};
	/** A ward ranking of the council on a related map, when one exists. */
	ranking?: { href: string; label: string };
};

const formatted = (value: number) => Math.round(value).toLocaleString("en-GB");

/** The trends charted for an area, in page order. */
export async function placeTrends(code: string): Promise<PlaceTrendView[]> {
	const page = await readAtlasPage<PlaceTrends>("place-trends").catch(
		() => null,
	);
	if (!page) return [];
	const views: PlaceTrendView[] = [];
	for (const [key, trend] of Object.entries(page.trends)) {
		const area = trend.areas[code];
		const last = area?.points.at(-1);
		const declaration = DATASET_DECLARATIONS.find(
			(dataset) => dataset.id === area?.dataset,
		);
		const declared = declaration?.placeTrends?.find(
			(trend) => trend.key === key,
		);
		if (!area || !last || !declaration || !declared) continue;
		const format = declared.format
			? (value: number) => formatDisplay(declared.format!, value)
			: formatted;
		const periodName = (period: string) =>
			`${trend.periodPrefix ?? ""}${period}`;
		const roundTo =
			trend.roundTo && last[1] >= trend.roundTo * 10 ? trend.roundTo : 1;
		const standing = trendStanding(trend, code);
		const index = standing ? await loadPlaceIndex() : undefined;
		const names = standing
			? Object.fromEntries(
					standing.peers.map((peer) => [
						peer.code,
						index!.areas.find(
							(entry) => entry[0] === peer.code,
						)?.[1] ?? peer.code,
					]),
				)
			: {};
		const council = COUNCIL_PLACES.get(code);
		const wardSlug = declared.wardMap;
		const wardMap = wardSlug ? findAtlasMap(wardSlug) : undefined;
		views.push({
			key,
			label: trend.label,
			area,
			periodName,
			format,
			change: declared.change ?? "percent",
			latest: { period: last[0], value: last[1], kind: trendKind(last) },
			rounded: format(Math.round(last[1] / roundTo) * roundTo),
			source: {
				name: declaration.source.name,
				publisher: declaration.source.publisher,
				edition: declaration.source.year,
				url: declaration.source.sourceUrl,
				licence: declaration.source.licence,
				licenceUrl: declaration.source.licenceUrl,
			},
			...(standing
				? {
						standing: {
							...standing,
							phrase: rankPhrase(
								standing.rank,
								standing.of,
								declared.ends,
							),
							names,
						},
					}
				: {}),
			...(wardMap && council && hasRankingFor(council.slug, wardMap.slug)
				? {
						ranking: {
							href: `/maps/${council.slug}/${wardMap.slug}`,
							label: `the wards of ${council.name} ranked by ${atlasMapTitle(wardMap).toLowerCase()}`,
						},
					}
				: {}),
		});
	}
	return views;
}

/** "Population about 275,000 (mid-2024).", for a page description. */
export const trendSentence = (view: PlaceTrendView) =>
	`${view.label} about ${view.rounded} (${view.periodName(view.latest.period)}).`;
