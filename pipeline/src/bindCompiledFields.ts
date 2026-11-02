import type { DatabaseSync } from "node:sqlite";
import type { Measure } from "@uk-data-atlas/atlas-runtime/catalogue";
import { CENSUS_BREAKDOWNS } from "./catalog/census";
import {
	expandStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport";

// These are the source fields used by the catalogue compilers. The canonical
// dataset layout records the series for each field, including its dimensions.
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
	"ghg-emissions": [["ghg-emissions", "totalKtCO2e"]],
	"total-jobs": [["jobs", "totalJobs"]],
	"mobile-4g-coverage": [["mobile-coverage", "pct4GIndoorAll"]],
	"mobile-5g-coverage": [["mobile-coverage", "pct5GOutdoorAll"]],
	"claimant-count": [["claimant-count", "totalCount"]],
	"claimant-count-16-to-24": [["claimant-count", "youthCount"]],
	"imd-rank": [["imd", "imdRank"]],
	"imd-decile": [["imd", "imdDecile"]],
	"wimd-rank": [["wimd", "wimdRank"]],
	"wimd-decile": [["wimd", "wimdDecile"]],
	"simd-rank": [["simd", "simdRank"]],
	"simd-decile": [["simd", "simdDecile"]],
	"nimdm-rank": [["nimdm", "nimdmRank"]],
	gva: ["itl1", "itl2", "itl3"].map((level) => [
		`regional-gdp-${level}`,
		"gvaMillionGbp",
	]),
	gdp: ["itl1", "itl2", "itl3"].map((level) => [
		`regional-gdp-${level}`,
		"gdpMillionGbp",
	]),
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
		database.prepare(`SELECT DISTINCT r.geography, r.id AS release, p.label AS period
		FROM dataset_leaf leaf JOIN dataset d ON d.id = leaf.dataset_id
		JOIN series s ON s.id = leaf.series_id JOIN area_releases r ON r.position = s.release_id
		JOIN period p ON p.id = leaf.period_id
		WHERE d.slug = ? AND leaf.path = ? AND leaf.kind = 'value' ORDER BY r.geography, r.id, p.label`);
	const selected: StatisticsSelection[] = [];
	for (const [dataset, field] of specs) {
		const path = field.split(".");
		const rows = lookup.all(dataset, JSON.stringify(path));
		if (!rows.length) return undefined;
		for (const row of rows)
			selected.push({
				dataset,
				path,
				geography: String(row.geography),
				release: String(row.release),
				periods: [String(row.period)],
			});
	}
	const expanded = expandStatisticsSelection(database, selected);
	return expanded.length ? expanded : undefined;
}
