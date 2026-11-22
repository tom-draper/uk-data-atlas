import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";
import type { ExactReleaseReference } from "@uk-data-atlas/areas";
import {
	convertedReleases,
	LOW_EXACT_SHARE,
	LOW_SERIES_COVERAGE,
	measureSeriesKey,
	measureSeriesKeySourceKey,
	readReleaseSeries,
	type Measure,
	type ReleaseSeries,
	type ReleaseSeriesPart,
	type ReleaseSeriesSpec,
	type Series,
	type StatisticsReadPath,
	type StatisticsSelector,
	type StatisticsTableSelector,
} from "@uk-data-atlas/measures";
import { statedDefaults } from "../dataDefaults";
import { envelope, problem, type ApiResponse } from "../runtime/index.ts";
import type { RouteContext } from "../runtime/routing.ts";

/**
 * A measure's series for one area, rebuilt on one boundary release: the
 * release's own published values where it has them, and otherwise the
 * values the build converted onto it, each naming its method and source.
 */

type Specs = Map<string, ReleaseSeriesSpec>;

/** Why a selector cannot be read on another release. */
const unsupported = (selector: StatisticsSelector): string | undefined => {
	if (selector.contest) return "a contest winner is a category, not a value";
	if (selector.plus)
		return "it adds measures that are not converted together";
	if (selector.halfWidth)
		return "its confidence interval is published as a separate half-width";
	if (selector.status) return "its values are already derived from others";
	if (selector.ratio?.datasetId || selector.ratio?.period)
		return "its denominator comes from another dataset or period";
	if (selector.ratio?.denominatorDivisor)
		return "its denominator is divided before use";
	return undefined;
};

const partOf = (selector: StatisticsSelector): ReleaseSeriesPart => ({
	datasetId: selector.datasetId,
	measure: selector.measure,
	dimensions: selector.dimensions,
	geography: selector.geography,
	...(selector.sum ? { sum: selector.sum } : {}),
});

/**
 * One spec per dataset, from every source of the measure: the same quantity
 * on each geography and release it is published on, so a series on any of
 * them may have been converted onto the target.
 */
const specsFor = (
	readPath: StatisticsReadPath,
	measure: Measure,
	seriesKey: string,
): { specs: Specs; refusals: string[] } => {
	const specs: Specs = new Map();
	const refusals = new Set<string>();
	const seen = new Set<string>();
	for (const source of measure.sources) {
		const found =
			readPath.series?.[measureSeriesKeySourceKey(seriesKey, source)];
		if (!found) continue;
		let selector: StatisticsSelector;
		if ((found as StatisticsTableSelector).kind === "measure-table") {
			const table = found as StatisticsTableSelector;
			const column = table.columns[table.measures.indexOf(measure.id)];
			if (!column) continue;
			selector = {
				datasetId: table.datasetId,
				geography: table.geography,
				measure: column.measure,
				dimensions: column.dimensions,
			};
		} else selector = found as StatisticsSelector;
		const why = unsupported(selector);
		if (why) {
			refusals.add(why);
			continue;
		}
		const part = partOf(selector);
		const key = JSON.stringify(part);
		if (seen.has(key)) continue;
		seen.add(key);
		let spec = specs.get(selector.datasetId);
		if (!spec) {
			spec = {
				parts: [],
				...(selector.ratio
					? {
							ratio: {
								parts: [],
								scale: selector.ratio.scale,
								...(selector.ratio.scaleQuotient
									? { scaleQuotient: true as const }
									: {}),
							},
						}
					: {}),
				...(selector.absentAsZero
					? { absentAsZero: true as const }
					: {}),
			};
			specs.set(selector.datasetId, spec);
		}
		spec.parts.push(part);
		if (selector.ratio && spec.ratio)
			spec.ratio.parts.push({
				...part,
				measure: selector.ratio.measure,
				dimensions: selector.ratio.dimensions ?? selector.dimensions,
			});
	}
	return { specs, refusals: [...refusals] };
};

/** A stored period as the catalogue names it: `2021` for `2021-census`. */
const catalogueLabel = (measure: Measure) => {
	const periods = new Set(
		measure.sources.flatMap((source) => source.periods),
	);
	return (stored: string) => {
		if (periods.has(stored)) return stored;
		for (const period of periods)
			if (stored.startsWith(`${period}-`)) return period;
		return stored;
	};
};

/** The standard releases, read once per database generation. */
let supported:
	{ key: string; releases: ReturnType<typeof convertedReleases> } | undefined;

type Warning = { code: string; message: string; periods: string[] };

const summaryOf = (series: ReleaseSeries) => {
	const counts = { native: 0, exact: 0, weighted: 0 };
	for (const value of series.values) counts[value.method] += 1;
	const periodsWith = (
		test: (value: ReleaseSeries["values"][number]) => boolean,
	) => series.values.filter(test).map((value) => value.period);
	const warnings: Warning[] = [];
	const warn = (code: string, message: string, periods: string[]) => {
		if (periods.length > 0) warnings.push({ code, message, periods });
	};
	warn(
		"weighted",
		"Part of these values was split from source areas the target cuts across, in proportion to a weight. They are estimates.",
		periodsWith((value) => value.method === "weighted"),
	);
	warn(
		"low-exact-share",
		`Less than ${LOW_EXACT_SHARE * 100}% of these values was regrouped from whole source areas.`,
		periodsWith((value) => value.flags.includes("low-exact-share")),
	);
	warn(
		"low-series-coverage",
		`The converted series behind these values hold a value for less than ${LOW_SERIES_COVERAGE * 100}% of the areas they reach.`,
		periodsWith((value) => value.flags.includes("low-series-coverage")),
	);
	warn(
		"area-not-on-source-release",
		"The area did not exist on the source release, so these values are built from its predecessors' areas. Reorganisations are not yet published as events (#426); this flag is how they show.",
		periodsWith((value) =>
			value.flags.includes("area-not-on-source-release"),
		),
	);
	warn(
		"gaps",
		"These periods are published on another release but have no value on this one. Each gap says why.",
		series.gaps.map((gap) => gap.period),
	);
	const periods = series.values.map((value) => value.period);
	return {
		periods: series.values.length,
		first: periods[0] ?? null,
		last: periods.at(-1) ?? null,
		...counts,
		gaps: series.gaps.length,
		convertedShare:
			series.values.length === 0
				? 0
				: (counts.exact + counts.weighted) / series.values.length,
		warnings,
	};
};

const publicValue = (value: ReleaseSeries["values"][number]) => ({
	period: value.period,
	value: value.value,
	status: value.status,
	...(value.lower === undefined
		? {}
		: { confidenceInterval: { lower: value.lower, upper: value.upper } }),
	method: value.method,
	...(value.method === "weighted" ? { exactShare: value.exactShare } : {}),
	...(value.source ? { source: value.source } : {}),
	...(value.rebuiltRatio ? { rebuiltRatio: true } : {}),
	...(value.flags.length > 0 ? { flags: value.flags } : {}),
});

/** A cache key that changes when the database file is replaced. */
const generationKeys = new Map<string, object>();
const generationKey = (path: string, generation: number) => {
	const key = `${path}:${generation}`;
	let held = generationKeys.get(key);
	if (!held) {
		generationKeys.clear();
		generationKeys.set(key, (held = {}));
	}
	return held;
};

export const releaseSeriesResponse = ({
	context,
	releaseId,
	measure,
	selectedSeries,
	publicId,
	publicMeasure,
	areaCode,
	on,
	datasetId,
}: {
	context: Pick<RouteContext, "atlasStatistics">;
	releaseId: string;
	measure: Measure;
	selectedSeries: Series | undefined;
	publicId: string;
	publicMeasure: unknown;
	areaCode: string;
	on: ExactReleaseReference;
	datasetId: string | null;
}): ApiResponse => {
	const statistics = context.atlasStatistics;
	if (!statistics)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the atlas database before retrieving a series on one boundary release.",
		);
	const seriesKey =
		selectedSeries?.id ??
		(measure.series ? measureSeriesKey(measure.series) : undefined);
	if (!seriesKey)
		return problem(
			503,
			"Catalogue Unavailable",
			`${publicId} has no series identity.`,
		);
	const database = openReadOnlyDatabase(statistics.databasePath);
	try {
		const cacheKey = generationKey(database.path, database.generation);
		const supportedKey = `${database.path}:${database.generation}`;
		if (supported?.key !== supportedKey)
			supported = {
				key: supportedKey,
				releases: convertedReleases(database),
			};
		const target = { geography: on.geography, release: on.boundaryRelease };
		if (
			!supported.releases.some(
				(release) =>
					release.geography === target.geography &&
					release.release === target.release,
			)
		)
			return problem(
				422,
				"Operation Not Supported",
				`Series are rebuilt only on the boundary releases that hold converted series: ${supported.releases
					.map((release) => `${release.geography}/${release.release}`)
					.join(", ")}. Leave out on= for a source's own release.`,
			);
		const { specs, refusals } = specsFor(
			statistics.readPath,
			measure,
			seriesKey,
		);
		const candidates = datasetId
			? [...specs].filter(([id]) => id === datasetId)
			: [...specs];
		if (candidates.length === 0)
			return problem(
				422,
				"Operation Not Supported",
				refusals.length > 0
					? `${publicId} cannot be rebuilt on another release: ${refusals.join("; ")}.`
					: datasetId
						? `${publicId} has no source in dataset ${datasetId}.`
						: `${publicId} has no source that can be rebuilt on another release.`,
			);
		const label = catalogueLabel(measure);
		const read = candidates.flatMap(([id, spec]) => {
			const series = readReleaseSeries(
				database,
				spec,
				target,
				areaCode,
				label,
				cacheKey,
			);
			return series ? [{ datasetId: id, series }] : [];
		});
		if (read.length === 0)
			return problem(
				404,
				"Not Found",
				`${areaCode} is not an area of ${target.geography}/${target.release}. A series on one release is asked for with that release's area code.`,
			);
		// Where several datasets publish the measure, the one with the most
		// values is served, and the choice is stated.
		const chosen = read.reduce((best, next) =>
			next.series.values.length > best.series.values.length ? next : best,
		);
		const defaulted =
			candidates.length > 1 ? { datasetId: chosen.datasetId } : undefined;
		const { series } = chosen;
		if (series.values.length === 0 && series.gaps.length === 0)
			return problem(
				404,
				"Not Found",
				`No source of ${publicId} holds a value for ${areaCode}, on that release or one converted onto it.`,
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				measure: publicMeasure,
				areaCode,
				areaName: series.areaName,
				on: {
					geography: target.geography,
					boundaryRelease: target.release,
				},
				datasetId: chosen.datasetId,
				...statedDefaults(defaulted),
				...(series.conversion ? { conversion: series.conversion } : {}),
				summary: summaryOf(series),
				provenance: {
					atlasRelease: { id: releaseId, href: "/v1/atlas-release" },
					dataset: {
						id: chosen.datasetId,
						href: `/v1/datasets/${chosen.datasetId}`,
					},
					note: "A native value is the release's own published value, unchanged. An exact value regroups whole source areas on the named crosswalks; a weighted one also splits some, in proportion to the basis. Values were converted when the atlas was built, under the rules in /docs/conversion-accuracy.",
				},
				series: series.values.map(publicValue),
				gaps: series.gaps.map(({ period, sources }) => ({
					period,
					sources,
				})),
			}),
		};
	} finally {
		database.release();
	}
};
