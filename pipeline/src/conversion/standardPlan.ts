import type { DatabaseSync } from "node:sqlite";
import type { CaseHop } from "./backtestCases.ts";
import { CONVERTED_PLAN, type PlanEntry } from "./convertedPlan.ts";
import { stepsOf, type Resolver } from "./pinnedRoutes.ts";
import { routeKey, type Route } from "./routes.ts";
import type { ConversionRule, MeasureRow } from "./rules.ts";
import { chooseBasis } from "./weightBasis.ts";

/**
 * The standard releases every measure is rebuilt on, and the plan that does it.
 *
 * Every published series of a measure that can be converted is offered each
 * standard release it is not already on. A route is kept only where it exists,
 * and the entry is dropped from the plan, with its reason, where it does not.
 * Whether a series then holds values on the target is the conversion's own
 * answer: a route that splits everything yields no value and is skipped as
 * `no-values`, not stored empty.
 *
 * The entries pinned in `convertedPlan.ts` take the place of a generated one
 * for the same source and target. They carry what a generated entry cannot
 * know: a note, a filter on the breakdowns kept, a route a reader checked.
 */

/** The latest release of each geography the atlas serves, as `geography:release`. */
export const STANDARD_RELEASES = [
	"localAuthority:2026-05-uk-bgc",
	"ward:2026-05-uk-bgc",
	"constituency:2024-07-uk-bgc",
	"lsoa:2021-12-ew-bgc-v5",
] as const;

/**
 * The most crosswalks a route may chain. The longest standard route, small
 * areas to the latest authorities through every boundary change, takes seven.
 */
export const MAX_ROUTE_HOPS = 7;

/** Why a published series is not offered a standard release at all. */
export type PlanSkipReason =
	/** The measure's rule is `refuse`. The reason is in `measure_conversion`. */
	| "refused-measure"
	/** No chain of crosswalks carries the source's release to the target. */
	| "no-route";

export type PlanSkip = {
	dataset: string;
	measure: string;
	/** `geography:release` the series are published on. */
	source: string;
	target: string;
	reason: PlanSkipReason;
	series: number;
};

export type PublishedGroup = {
	dataset: string;
	measure: string;
	releaseId: number;
	series: number;
};

/** Every dataset, measure and release with published series, and how many. */
export const publishedGroups = (database: DatabaseSync): PublishedGroup[] =>
	database
		.prepare(
			`SELECT d.slug AS dataset, m.slug AS measure, s.release_id AS releaseId, count(*) AS series
			FROM series s
			JOIN dataset d ON d.id = s.dataset_id
			JOIN measure m ON m.id = s.measure_id
			WHERE s.method = 'published'
			GROUP BY d.slug, m.slug, s.release_id
			ORDER BY d.slug, m.slug, s.release_id`,
		)
		.all() as PublishedGroup[];

/**
 * The best route of those found: the fewest hops that can split a value, then
 * the fewest hops, then the order of their keys, so the choice never moves.
 */
export const bestRoute = (routes: readonly Route[]): Route | undefined =>
	[...routes].sort(
		(a, b) =>
			a.filter((hop) => !hop.exact).length -
				b.filter((hop) => !hop.exact).length ||
			a.length - b.length ||
			routeKey(a).localeCompare(routeKey(b)),
	)[0];

const caseHops = (resolver: Resolver, route: Route): CaseHop[] =>
	route.map((hop) => ({
		crosswalks: hop.crosswalks.map(
			(id) => resolver.router.crosswalk(id).slug,
		),
		...(hop.reversed ? { reversed: true } : {}),
	}));

export type StandardPlan = {
	entries: PlanEntry[];
	skips: PlanSkip[];
};

export const planStandardReleases = (
	database: DatabaseSync,
	resolver: Resolver,
	measures: ReadonlyMap<
		string,
		{ measure: MeasureRow; rule: ConversionRule }
	>,
	pinned: readonly PlanEntry[] = CONVERTED_PLAN,
	targets: readonly string[] = STANDARD_RELEASES,
): StandardPlan => {
	const entries = new Map<string, PlanEntry>();
	const skips: PlanSkip[] = [];
	const releaseName = (id: number) => {
		const { geography, release } = resolver.router.release(id);
		return `${geography}:${release}`;
	};
	const found = new Map<string, Route | undefined>();
	const routeBetween = (from: number, to: number) => {
		const key = `${from}>${to}`;
		if (!found.has(key))
			found.set(
				key,
				bestRoute(resolver.router.routes(from, to, MAX_ROUTE_HOPS)),
			);
		return found.get(key);
	};
	const pins = new Map(
		pinned.map((entry) => [
			`${entry.source.dataset}|${entry.source.measure}|${entry.source.release}|${entry.target}`,
			entry,
		]),
	);

	for (const group of publishedGroups(database)) {
		const ruled = measures.get(group.measure);
		if (!ruled) throw new Error(`No measure ${group.measure}`);
		const source = releaseName(group.releaseId);
		for (const target of targets) {
			if (target === source) continue;
			const skip = (reason: PlanSkipReason) =>
				skips.push({
					dataset: group.dataset,
					measure: group.measure,
					source,
					target,
					reason,
					series: group.series,
				});
			if (ruled.rule.rule === "refuse") {
				skip("refused-measure");
				continue;
			}
			const pin = pins.get(
				`${group.dataset}|${group.measure}|${source}|${target}`,
			);
			const route = pin
				? undefined
				: routeBetween(group.releaseId, resolver.releaseId(target));
			if (!pin && !route) {
				skip("no-route");
				continue;
			}
			const hops = pin ? pin.route : caseHops(resolver, route!);
			const entry: PlanEntry = {
				id:
					pin?.id ??
					`${group.dataset}/${group.measure}@${source}>${target}`,
				source: {
					dataset: group.dataset,
					measure: group.measure,
					release: source,
				},
				target,
				route: hops,
				basis:
					pin?.basis ??
					chooseBasis(ruled.measure, (basis) =>
						stepsOf(resolver, hops, basis, group.releaseId),
					),
				members: pin?.members,
				estimates: pin?.estimates,
				note: pin?.note,
			};
			entries.set(entry.id, entry);
		}
	}
	return { entries: [...entries.values()], skips };
};
