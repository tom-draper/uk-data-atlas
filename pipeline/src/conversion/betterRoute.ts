import {
	qualityOf,
	type ConvertedObservation,
	type ConvertedSeries,
	type SeriesGap,
} from "./convertSeries.ts";

/**
 * One converted value for each target area and period.
 *
 * A dataset published on several source releases (councils and constituencies,
 * or several council editions) is converted from each of them onto the same
 * target, and the copies can reach the same area and period by different
 * routes, with different values. This keeps one of them.
 *
 * The choice is made after conversion, where the quality of each route is
 * known, and for each target area and period, so two sources that cover
 * different periods both stay, and a source that holds areas the better one
 * lacks keeps them. Each value that loses is not stored. It becomes a gap of
 * its series with the reason `better-route`, and a series left with no value
 * is not stored at all and is reported by its caller as skipped.
 */

/** The reason a gap or a skip gives for a value left to a better route. */
export const BETTER_ROUTE = "better-route";

/** A converted series with what ranks it against the others for its target. */
export type RouteCandidate = {
	series: ConvertedSeries;
	/** The geography the series was converted from, such as `ward`. */
	sourceGeography: string;
	/** The release it was converted from, such as `2024-05-uk-bgc`. */
	sourceRelease: string;
	/** The geography of the target release. */
	targetGeography: string;
};

/**
 * Orders candidates best first: a source on the target's geography, because
 * regrouping beats splitting, then the higher exact share, then the higher
 * coverage, then the newer source release, then the series key so that a tie
 * never moves between builds.
 */
export const compareRoutes = (a: RouteCandidate, b: RouteCandidate): number => {
	const same = (c: RouteCandidate) =>
		c.sourceGeography === c.targetGeography ? 1 : 0;
	const [qa, qb] = [a.series.quality, b.series.quality];
	return (
		same(b) - same(a) ||
		qb.exactShare - qa.exactShare ||
		qb.coverage - qa.coverage ||
		b.sourceRelease.localeCompare(a.sourceRelease) ||
		(a.series.key < b.series.key ? -1 : a.series.key > b.series.key ? 1 : 0)
	);
};

/** What the choice left of each candidate. */
export type RouteChoice = {
	/** Series that keep at least one value, in the order given. */
	kept: ConvertedSeries[];
	/** Series that lost every value to a better route, in the order given. */
	dropped: ConvertedSeries[];
	/** The values of kept series that were left to a better route. */
	clipped: number;
};

const cell = (o: { area: number; period: number }) => `${o.area}:${o.period}`;

/** What a series holds as the same series: dataset, measure, target and members. */
const seriesGroup = (series: ConvertedSeries) =>
	`${series.datasetId}|${series.measureId}|${series.releaseId}|${series.inputs[0]!.series.members}`;

/**
 * Keeps one value for each area and period of each group of series that
 * share a dataset, measure, members and target release.
 *
 * Within a group the best route claims its values first, then the next claims
 * those the better ones left, and so on. A series that loses some of its
 * values is returned with those values moved to its gaps and its quality
 * counted again on what it keeps, so the exact share and coverage describe
 * what is stored. The ranking itself uses the quality each series had before.
 */
export const chooseRoutes = (
	candidates: readonly RouteCandidate[],
): RouteChoice => {
	const groups = new Map<string, RouteCandidate[]>();
	for (const candidate of candidates) {
		const key = seriesGroup(candidate.series);
		const held = groups.get(key);
		if (held) held.push(candidate);
		else groups.set(key, [candidate]);
	}
	const result = new Map<ConvertedSeries, ConvertedSeries | null>();
	let clipped = 0;
	for (const group of groups.values()) {
		if (group.length === 1) {
			result.set(group[0]!.series, group[0]!.series);
			continue;
		}
		const ranked = [...group].sort(compareRoutes);
		const claimed = new Set<string>();
		for (const { series } of ranked) {
			const kept: ConvertedObservation[] = [];
			const lost: SeriesGap[] = [];
			for (const o of series.observations) {
				if (claimed.has(cell(o)))
					lost.push({
						area: o.area,
						period: o.period,
						reason: BETTER_ROUTE,
					});
				else kept.push(o);
			}
			for (const o of kept) claimed.add(cell(o));
			if (lost.length === 0) result.set(series, series);
			else if (kept.length === 0) result.set(series, null);
			else {
				clipped += lost.length;
				const gaps = [...series.gaps, ...lost];
				result.set(series, {
					...series,
					observations: kept,
					gaps,
					quality: qualityOf(kept, gaps),
				});
			}
		}
	}
	const kept: ConvertedSeries[] = [];
	const dropped: ConvertedSeries[] = [];
	for (const { series } of candidates) {
		const made = result.get(series);
		if (made) kept.push(made);
		else dropped.push(series);
	}
	return { kept, dropped, clipped };
};
