import { join } from "node:path";
import { openReadOnlyDatabase, type SqlReader } from "@uk-data-atlas/atlas-db";
import {
	readReleaseSeries,
	type ReleaseSeries,
	type ReleaseSeriesSpec,
	type ReleaseValue,
} from "@uk-data-atlas/measures";
import {
	DATASET_DECLARATIONS,
	type PlaceTrendDeclaration,
} from "@uk-data-atlas/datasets";
import type {
	PlaceTrendArea,
	PlaceTrendEvent,
	PlaceTrendPoint,
	PlaceTrends,
} from "@uk-data-atlas/catalogue/place-trends";

/**
 * The series place pages chart, each on its place's latest boundary release.
 * A place's series comes from one dataset, the one holding the most periods
 * for it, so it is never stitched from two publishers.
 */

/** The councils to chart, each with the release its page shows. */
export type TrendPlace = { code: string; release: string };

/** Changes that made an area out of others; a realignment is not one. */
const MAKING_KINDS = ["merged", "split", "redistributed", "redrawn"];

const specOf = (
	dataset: string,
	trend: PlaceTrendDeclaration,
): ReleaseSeriesSpec => ({
	parts: [
		{
			datasetId: dataset,
			measure: trend.measure,
			dimensions: { ...trend.dimensions },
			geography: "localAuthority",
			...(trend.sum ? { sum: [...trend.sum] } : {}),
		},
	],
});

/** The declared trends, each with the datasets that publish it. */
export function declaredTrends() {
	const trends = new Map<
		string,
		{ declaration: PlaceTrendDeclaration; datasets: string[] }
	>();
	for (const declaration of DATASET_DECLARATIONS) {
		const trend = declaration.placeTrend;
		if (!trend) continue;
		const held = trends.get(trend.key);
		if (held) held.datasets.push(declaration.id);
		else
			trends.set(trend.key, {
				declaration: trend,
				datasets: [declaration.id],
			});
	}
	return [...trends.values()].sort(
		(a, b) => a.declaration.order - b.declaration.order,
	);
}

/**
 * A point, marked published where the value is the publisher's own figure
 * for this code: native to the release, or carried exactly from a release
 * where the same code was published with the same value.
 */
const stored = (value: number) => Math.round(value * 100) / 100;

export function pointOf(
	value: ReleaseValue,
	publishedOn: (release: string, period: string) => number | undefined,
): PlaceTrendPoint {
	if (value.method === "weighted")
		return [
			value.period,
			stored(value.value),
			2,
			stored(value.lower ?? value.value),
			stored(value.upper ?? value.value),
		];
	if (value.method === "native")
		return [value.period, stored(value.value), 0];
	const release = value.source?.release.split(":")[1];
	const published =
		release && !value.flags.includes("area-not-on-source-release")
			? publishedOn(release, value.period)
			: undefined;
	return [
		value.period,
		stored(value.value),
		published !== undefined && Math.abs(published - value.value) < 0.5
			? 0
			: 1,
	];
}

function eventsOf(database: SqlReader, code: string): PlaceTrendEvent[] {
	const events = database
		.prepare(
			`SELECT event_id AS id, kind, effective_date AS date FROM v_area_change
			WHERE geography = 'localAuthority' AND side = 'to' AND code = ? AND realigned = 0
			AND kind IN (${MAKING_KINDS.map(() => "?").join(", ")})
			ORDER BY effective_date`,
		)
		.all(code, ...MAKING_KINDS);
	const from = database.prepare(
		"SELECT code, name FROM v_area_change WHERE event_id = ? AND side = 'from' AND code <> ? ORDER BY name",
	);
	return events.map((event) => ({
		date: String(event.date),
		kind: String(event.kind),
		from: from
			.all(Number(event.id), code)
			.map((row) => [String(row.code), String(row.name)]),
	}));
}

export function buildPlaceTrends(
	root: string,
	places: readonly TrendPlace[],
): PlaceTrends {
	const database = openReadOnlyDatabase(
		join(root, "data/build/atlas.sqlite"),
	);
	try {
		const trends: PlaceTrends["trends"] = {};
		for (const { declaration, datasets } of declaredTrends()) {
			const areas: Record<string, PlaceTrendArea> = {};
			for (const place of places) {
				let best:
					{ dataset: string; series: ReleaseSeries } | undefined;
				for (const dataset of datasets) {
					const spec = specOf(dataset, declaration);
					const series = readReleaseSeries(
						database,
						spec,
						{ geography: "localAuthority", release: place.release },
						place.code,
					);
					if (
						series &&
						series.values.length > (best?.series.values.length ?? 0)
					)
						best = { dataset, series };
				}
				if (!best) continue;
				const { dataset } = best;
				const native = new Map<string, Map<string, number>>();
				const publishedOn = (release: string, period: string) => {
					let values = native.get(release);
					if (!values) {
						const series = readReleaseSeries(
							database,
							specOf(dataset, declaration),
							{ geography: "localAuthority", release },
							place.code,
						);
						values = new Map(
							(series?.values ?? [])
								.filter((value) => value.method === "native")
								.map((value) => [value.period, value.value]),
						);
						native.set(release, values);
					}
					return values.get(period);
				};
				areas[place.code] = {
					dataset,
					release: place.release,
					points: best.series.values.map((value) =>
						pointOf(value, publishedOn),
					),
					events: eventsOf(database, place.code),
				};
			}
			trends[declaration.key] = {
				label: declaration.label,
				...(declaration.periodPrefix
					? { periodPrefix: declaration.periodPrefix }
					: {}),
				...(declaration.roundTo
					? { roundTo: declaration.roundTo }
					: {}),
				areas,
			};
		}
		return { version: 1, trends };
	} finally {
		database.release();
	}
}
