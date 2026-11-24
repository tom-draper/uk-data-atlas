/**
 * The series place pages chart on a place's current boundary, compiled from
 * `atlas.sqlite` by the atlas-pages stage. Each point says how it was made, so
 * a page can mark a converted value apart from a published one.
 */

/**
 * How a point was made. `published`: the publisher's own figure for this
 * area. `regrouped`: whole earlier areas added up, an exact sum with no
 * estimate in it. `estimated`: part of it was split from areas the boundary
 * cuts across, so it carries bounds.
 */
export const TREND_KINDS = ["published", "regrouped", "estimated"] as const;
export type PlaceTrendKind = (typeof TREND_KINDS)[number];

/** A point: period, value, its kind's index in `TREND_KINDS`, and any bounds. */
export type PlaceTrendPoint =
	| [period: string, value: number, kind: 0 | 1]
	| [period: string, value: number, kind: 2, lower: number, upper: number];

/** A boundary change that made the area, as `v_area_change` records it. */
export type PlaceTrendEvent = {
	/** `YYYY-MM-DD`, the date it took effect. */
	date: string;
	kind: string;
	/** The areas it was made from, as code and name. */
	from: [code: string, name: string][];
};

export type PlaceTrendArea = {
	/** The dataset the whole series comes from. */
	dataset: string;
	/** The boundary release the series is on, the place's latest. */
	release: string;
	points: PlaceTrendPoint[];
	events: PlaceTrendEvent[];
};

export type PlaceTrend = {
	label: string;
	periodPrefix?: string;
	roundTo?: number;
	areas: Record<string, PlaceTrendArea>;
};

export type PlaceTrends = {
	version: 1;
	/** By the declared key, in page order. */
	trends: Record<string, PlaceTrend>;
};

export const trendKind = (point: PlaceTrendPoint): PlaceTrendKind =>
	TREND_KINDS[point[2]];

/**
 * Comparable councils: the same kind of council in the same nation, which
 * their code's first three characters name.
 */
export const COUNCIL_GROUPS: Readonly<Record<string, [string, string]>> = {
	E06: ["unitary authority", "unitary authorities in England"],
	E07: ["district council", "district councils in England"],
	E08: ["metropolitan borough", "metropolitan boroughs"],
	E09: ["London borough", "London boroughs"],
	W06: ["Welsh council", "Welsh councils"],
	S12: ["Scottish council area", "Scottish council areas"],
	N09: ["Northern Irish district", "Northern Irish districts"],
};

export const councilGroupOf = (code: string) => code.slice(0, 3);

export type TrendPeer = { code: string; value: number; rank: number };

export type TrendStanding = {
	group: string;
	/** The group's name, plural. */
	groupName: string;
	period: string;
	rank: number;
	of: number;
	/** The nearest councils by value, largest first, the area among them. */
	peers: TrendPeer[];
};

/**
 * Where an area's latest value ranks among comparable councils that hold the
 * same period from the same dataset, and the councils nearest it.
 */
export function trendStanding(
	trend: PlaceTrend,
	code: string,
	nearest = 2,
): TrendStanding | undefined {
	const group = councilGroupOf(code);
	const names = COUNCIL_GROUPS[group];
	const own = trend.areas[code];
	const last = own?.points.at(-1);
	if (!names || !own || !last) return undefined;
	const ranked = Object.entries(trend.areas)
		.flatMap(([other, area]) => {
			const point = area.points.at(-1);
			return councilGroupOf(other) === group &&
				area.dataset === own.dataset &&
				point?.[0] === last[0]
				? [{ code: other, value: point[1] }]
				: [];
		})
		.sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))
		.map((peer, index) => ({ ...peer, rank: index + 1 }));
	const at = ranked.findIndex((peer) => peer.code === code);
	if (at < 0) return undefined;
	const start = Math.max(
		0,
		Math.min(at - nearest, ranked.length - (2 * nearest + 1)),
	);
	return {
		group,
		groupName: names[1],
		period: last[0],
		rank: ranked[at]!.rank,
		of: ranked.length,
		peers: ranked.slice(start, start + 2 * nearest + 1),
	};
}
