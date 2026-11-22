import type { DatabaseSync } from "node:sqlite";
import type { CaseHop } from "./backtestCases.ts";
import { MAX_CHAIN_HOPS } from "./chains.ts";
import { CONVERTED_PLAN, PERSONS, type PlanEntry } from "./convertedPlan.ts";
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
	| "no-route"
	/**
	 * Every value of the series, converted, was already held for its target
	 * area and period by a source ranked above it (see `betterRoute.ts`). The
	 * planner cannot know this, since it needs the quality of the converted
	 * series, so the converted-series stage records it.
	 */
	| "better-route";

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
 * the fewest that pass through a best-fit membership lookup, then the fewest
 * hops, then the order of their keys, so the choice never moves. A best-fit
 * lookup is taken only where no route avoids it: LSOAs nest in authorities,
 * so a route through the LSOA to ward lookup reaches an authority no better
 * and drops those whose small wards no LSOA is fitted to.
 */
export const bestRoute = (routes: readonly Route[]): Route | undefined =>
	[...routes].sort(
		(a, b) =>
			a.filter((hop) => !hop.exact).length -
				b.filter((hop) => !hop.exact).length ||
			a.filter((hop) => hop.bestFit).length -
				b.filter((hop) => hop.bestFit).length ||
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

/**
 * The datasets of mid-year population estimates, finest areas first, each on
 * the release it is published on: the small areas of each nation (LSOAs and
 * the data zones of Scotland and Northern Ireland), then wards, councils and
 * constituencies. Deprivation indices hold population as a denominator, for
 * one year each, and are not offered.
 */
export const POPULATION_DATASETS = [
	"population-lsoa",
	"population-data-zone-scotland",
	"population-data-zone-ni",
	"population",
	"population-uk",
	"population-constituency",
] as const;

/** The small-area datasets, which publish the total of persons alone. */
const SMALL_AREA_POPULATION: ReadonlySet<string> = new Set([
	"population-lsoa",
	"population-data-zone-scotland",
	"population-data-zone-ni",
]);

/** The geographies a population total is converted onto, on every release. */
export const POPULATION_GEOGRAPHIES = [
	"localAuthority",
	"ward",
	"constituency",
] as const;

/**
 * Every year of mid-year population on every release of the geographies
 * above, as a total of persons of all ages.
 *
 * Each standard release already gets the population by age and sex from
 * `planStandardReleases`, so it is left out. Every other release gets the
 * total alone: the breakdown on every release would multiply the atlas by
 * the 91 ages for little use. A route may chain as many crosswalks as a chain
 * of the oldest release does (`MAX_CHAIN_HOPS`), and the total is split on
 * population, the one basis a population split is backtested on.
 *
 * The finest source of each year is preferred: a dataset is not offered a
 * target that finer datasets already reach for every year and nation it
 * holds, and the target is recorded as a `better-route` skip for it. Nations
 * count because the small areas are published one nation at a time: LSOAs
 * reaching a council release for every year leave its Scottish and Northern
 * Irish councils to the council estimates.
 */
export const planPopulationReleases = (
	database: DatabaseSync,
	resolver: Resolver,
	datasets: readonly string[] = POPULATION_DATASETS,
	exclude: readonly string[] = STANDARD_RELEASES,
): StandardPlan => {
	const entries: PlanEntry[] = [];
	const skips: PlanSkip[] = [];
	const targets = (
		database
			.prepare(
				`SELECT geography || ':' || release AS name FROM area_release
				WHERE geography IN (${POPULATION_GEOGRAPHIES.map(() => "?").join(", ")})
				ORDER BY geography, release`,
			)
			.all(...POPULATION_GEOGRAPHIES) as { name: string }[]
	)
		.map((row) => row.name)
		.filter((name) => !exclude.includes(name));
	const groups = publishedGroups(database)
		.filter(
			(group) =>
				group.measure === "population" &&
				datasets.includes(group.dataset),
		)
		.sort(
			(a, b) =>
				datasets.indexOf(a.dataset) - datasets.indexOf(b.dataset) ||
				a.releaseId - b.releaseId,
		);
	const periodsOf = database.prepare(
		`SELECT DISTINCT o.period_id AS period, substr(a.code, 1, 1) AS nation
		FROM series s
		JOIN dataset d ON d.id = s.dataset_id
		JOIN measure m ON m.id = s.measure_id
		JOIN observation o ON o.series_id = s.id
		JOIN area_version v ON v.id = o.area_version_id
		JOIN area a ON a.id = v.area_id
		WHERE d.slug = ? AND m.slug = ? AND s.release_id = ? AND s.method = 'published'`,
	);
	/**
	 * The periods and nations the finer datasets already planned reach, by
	 * target, as `period:nation` (the first letter of the area code).
	 */
	const reached = new Map<string, Set<string>>();
	for (const group of groups) {
		const held = (
			periodsOf.all(group.dataset, group.measure, group.releaseId) as {
				period: number;
				nation: string;
			}[]
		).map((row) => `${row.period}:${row.nation}`);
		const { geography, release } = resolver.router.release(group.releaseId);
		const source = `${geography}:${release}`;
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
			const finer = reached.get(target);
			if (finer && held.every((key) => finer.has(key))) {
				skip("better-route");
				continue;
			}
			const route = bestRoute(
				resolver.router.routes(
					group.releaseId,
					resolver.releaseId(target),
					MAX_CHAIN_HOPS,
				),
			);
			if (!route) {
				skip("no-route");
				continue;
			}
			const reach = reached.get(target) ?? new Set<string>();
			for (const key of held) reach.add(key);
			reached.set(target, reach);
			entries.push({
				id: `${group.dataset}/${group.measure}@${source}>${target}#total`,
				source: {
					dataset: group.dataset,
					measure: group.measure,
					release: source,
				},
				target,
				route: caseHops(resolver, route),
				basis: "population",
				members: PERSONS,
				estimates: true,
				total: true,
				note: SMALL_AREA_POPULATION.has(group.dataset)
					? "Persons of all ages, the published small-area total, converted."
					: "Persons of all ages, the sum of the single years of age, converted.",
			});
		}
	}
	return { entries, skips };
};
