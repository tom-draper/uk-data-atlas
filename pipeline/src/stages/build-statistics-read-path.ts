import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	measureSeriesSourceKey,
	observationArtifactName,
	type DataCatalog,
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";
import { type StatisticsReadPath } from "@uk-data-atlas/measures";
import {
	artifactDirectory,
	statisticsReadPathPath,
	statisticsVocabularyPath,
	buildDirectory,
} from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";
import { selectorFor, seriesDimensions } from "../statistics/seriesSelector.ts";
import {
	censusTableSelector,
	partitionByCodeYear,
} from "../statistics/selectorPlans.ts";

/**
 * Select statistics rows for every catalogue artifact from declarations and
 * the statistics registry.
 */
const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
);
const databasePath = join(buildDirectory(repositoryRoot), "atlas-base.sqlite");
const catalog = readJsonSync(
	join(artifactDirectory(repositoryRoot), "data-catalog.json"),
) as DataCatalog;
const vocabulary = readJsonSync(
	statisticsVocabularyPath(repositoryRoot),
) as StatisticsVocabulary;
const database = new DatabaseSync(databasePath, { readOnly: true });

/** The releases of a geography published in a code year. */
const releasesIn = (geography: string, year: number) =>
	database
		.prepare(
			"SELECT release FROM area_release WHERE geography = ? AND release LIKE ? ORDER BY release",
		)
		.all(geography, `${year}-%`)
		.map((row) => String(row.release));

const plan: StatisticsReadPath & {
	series: NonNullable<StatisticsReadPath["series"]>;
} = {
	schemaVersion: 1,
	dataCatalogHash: catalog.contentHash,
	series: {},
	observations: {},
};
const tables = new Set<string>();
const keys = new Set<string>();
for (const measure of catalog.measures)
	for (const source of measure.sources) {
		const identity = measure.series;
		if (!identity)
			throw new Error(`Missing series identity for ${measure.id}.`);
		const key = measureSeriesSourceKey(identity, source);
		if (keys.has(key))
			throw new Error(`Duplicate statistics series source: ${key}.`);
		keys.add(key);
		const name = observationArtifactName(measure.id, source);
		const table = censusTableSelector(
			name,
			source.datasetId,
			source.sourceGeography.type,
			source.sourceGeography.boundaryYear,
			source.periods[0]!,
		);
		if (table) {
			if (source.periods.length !== 1)
				throw new Error(`Census table ${name} must have one period`);
			if (!tables.has(name)) {
				for (const column of table.columns)
					if (
						!seriesDimensions(
							database,
							table.datasetId,
							column.measure,
							table.geography,
						).length
					)
						throw new Error(
							`Census table ${name} has no ${column.measure} series`,
						);
				tables.add(name);
			}
			plan.series[key] = table;
			continue;
		}
		const selector = selectorFor(
			database,
			vocabulary,
			identity,
			source.datasetId,
			source.sourceGeography.type,
			source.sourceGeography.boundaryYear,
		);
		if (typeof selector === "string") {
			plan.observations[key] = selector;
			continue;
		}
		plan.series[key] = partitionByCodeYear(
			selector,
			source.datasetId,
			releasesIn(
				source.sourceGeography.type,
				source.sourceGeography.boundaryYear,
			),
		);
	}
database.close();
if (Object.keys(plan.observations).length)
	throw new Error(
		`Statistics selectors failed validation:\n${Object.entries(
			plan.observations,
		)
			.map(([name, reason]) => `${name}: ${reason}`)
			.join("\n")}`,
	);

const sorted = <T>(entries: { [key: string]: T }) =>
	Object.fromEntries(
		Object.entries(entries).sort(([left], [right]) =>
			left.localeCompare(right),
		),
	);
const file = statisticsReadPathPath(repositoryRoot);
writeFileSync(
	file,
	`${JSON.stringify(
		{
			schemaVersion: 1,
			dataCatalogHash: plan.dataCatalogHash,
			series: sorted(plan.series),
			observations: sorted(plan.observations),
		},
		null,
		"\t",
	)}\n`,
);
console.log(
	`${Object.keys(plan.series).length} series read from statistics rows. Wrote ${file}`,
);
