import type { DatabaseSync } from "node:sqlite";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import type { Measure } from "@uk-data-atlas/catalogue/node";
import { CENSUS_BREAKDOWNS } from "../catalog/census.ts";
import {
	declaredFieldSeries,
	type DatasetLookup,
} from "./declaredFieldSeries.ts";
import {
	expandStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport.ts";

// These are the source fields used by the catalogue compilers. Each dataset's
// declaration maps a field to its series and period.
const fields: Record<string, Array<readonly [string, string]>> = {
	...Object.fromEntries(
		CENSUS_BREAKDOWNS.flatMap((breakdown) =>
			breakdown.categories.map(([suffix, path]) => [
				`${breakdown.datasetId}-${suffix}`,
				[
					[
						breakdown.datasetId,
						breakdown.field ? `${breakdown.field}.${path}` : path,
					],
				],
			]),
		),
	),
	// An indicator the catalogue compiler cannot trace to one field of one
	// period (merged authorities, a file with a period per year) is bound here.
	...Object.fromEntries(
		DATASET_DECLARATIONS.filter(
			({ catalogue }) => catalogue?.mergeApril2023 || catalogue?.yearly,
		).flatMap((declaration) =>
			(declaration.catalogue?.indicators ?? []).map((indicator) => [
				indicator.id,
				[[declaration.id, indicator.field]],
			]),
		),
	),
	"ghg-emissions": [["ghg-emissions", "totalKtCO2e"]],
	"total-jobs": [["jobs", "totalJobs"]],
	"life-expectancy-male": [["life-expectancy-series", "male.value"]],
	"life-expectancy-female": [["life-expectancy-series", "female.value"]],
	"unemployment-rate": [["unemployment", "rates.1996"]],
	"unemployment-level": [["unemployment", "levels.1996"]],
	"road-collisions": [["road-collisions", "collisions"]],
	"road-collisions-fatal": [["road-collisions", "fatal"]],
	"road-collisions-serious": [["road-collisions", "serious"]],
	"road-collisions-slight": [["road-collisions", "slight"]],
	"air-quality-grid-cells": [["air-quality", "gridCells"]],
	"no2-background-mean": [["air-quality", "no2Mean"]],
	"pm10-background-mean": [["air-quality", "pm10Mean"]],
	"pm25-background-mean": [["air-quality", "pm25Mean"]],
	"general-election-valid-votes": [["general-election", "validVotes"]],
	"local-election-turnout": [["local-election", "turnoutPercent"]],
	"local-election-effective-votes": [["local-election", "partyVotes.LAB"]],
	"imd-rank": [["imd", "imdRank"]],
	"imd-decile": [["imd", "imdDecile"]],
	"wimd-rank": [["wimd", "wimdRank"]],
	"wimd-decile": [["wimd", "wimdDecile"]],
	"simd-rank": [["simd", "simdRank"]],
	"simd-decile": [["simd", "simdDecile"]],
	"nimdm-rank": [["nimdm", "nimdmRank"]],
	gva: [["regional-gdp", "gvaMillionGbp"]],
	gdp: [["regional-gdp", "gdpMillionGbp"]],
	...Object.fromEntries(
		["electricity", "gas"].flatMap((fuel) => [
			[`${fuel}-consumption`, [[`${fuel}-consumption`, "allMetersGwh"]]],
			[
				`${fuel}-consumption-domestic`,
				[[`${fuel}-consumption`, "domesticGwh"]],
			],
			[
				`${fuel}-consumption-non-domestic`,
				[[`${fuel}-consumption`, "nonDomesticGwh"]],
			],
		]),
	),
};

/** Resolve the compiler's field in every source dataset before exporting. */
export function bindCompiledFields(
	database: DatabaseSync,
	measure: Measure,
	datasets?: DatasetLookup,
): StatisticsSelection[] | undefined {
	const specs = fields[measure.id];
	if (!specs) return undefined;
	const sourceDatasets = new Set(
		measure.sources.map((source) => source.datasetId),
	);
	if (
		sourceDatasets.size !== specs.length ||
		specs.some(([dataset]) => !sourceDatasets.has(dataset))
	)
		return undefined;
	const lookup =
		database.prepare(`SELECT DISTINCT r.geography, r.release AS release, p.label AS period
		FROM dataset d JOIN series s ON s.method = 'published' AND s.dataset_id = d.id JOIN measure m ON m.id = s.measure_id
		JOIN area_releases r ON r.id = s.release_id
		JOIN observation o ON o.series_id = s.id JOIN period p ON p.id = o.period_id
		WHERE d.slug = ? AND m.slug = ? AND p.label = ?
		AND (SELECT count(*) FROM series_member sm WHERE sm.series_id = s.id) = ?
		AND NOT EXISTS (SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (
			SELECT 1 FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
			JOIN dimension_member dm ON dm.id = sm.member_id
			WHERE sm.series_id = s.id AND dim.slug = expected.key AND dm.code = expected.value
		)) ORDER BY r.geography, r.release, p.label`);
	const selected: StatisticsSelection[] = [];
	for (const [dataset, field] of specs) {
		const found = declaredFieldSeries(
			database,
			dataset,
			field.split("."),
			undefined,
			datasets,
		);
		const before = selected.length;
		for (const { measure: slug, members, period } of found)
			for (const row of lookup.all(
				dataset,
				slug,
				period,
				Object.keys(members).length,
				JSON.stringify(members),
			))
				selected.push({
					dataset,
					measure: slug,
					members,
					exact: true,
					geography: String(row.geography),
					release: String(row.release),
					periods: [String(row.period)],
				});
		if (selected.length === before) return undefined;
	}
	const expanded = expandStatisticsSelection(database, selected);
	return expanded.length ? expanded : undefined;
}
