import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	STATISTICS_DATASETS,
	readMeasureDimensionsConfig,
	type AreaIndex,
	type StatisticsDataset,
	type StatisticsDimension,
	type StatisticsInput,
	type StatisticsMeasure,
	type StatisticsSeries,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	CENSUS_SMALL_AREA_DIRECTORY,
	CENSUS_SMALL_AREA_GEOGRAPHIES,
	CENSUS_SMALL_AREA_TABLES,
	censusTableRecords,
	type CensusTable,
} from "./catalog/censusSmallArea";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";

/**
 * The census small-area tables as statistics rows: one dataset per table,
 * one series per category and geography, named by the measure and members
 * the API's measure mapping gives each category's measure id.
 *
 * Measures, and dimensions whose members another dataset declares in full,
 * are those datasets' own. A dimension or member no stored dataset holds
 * comes from the mapping, which declares it until it is stored here; such a
 * dimension is declared after the members it shares, so their positions are
 * unchanged. These datasets must therefore follow the declared ones.
 */

const BOUNDARY_YEAR = 2021;

type Meta = {
	title: string;
	description: string;
	publisher: string;
	sourceUrl: string;
	licence: { name: string; url?: string };
};

/** Every measure and fully listed dimension the declared datasets store. */
const declared = () => {
	const measures = new Map<string, StatisticsMeasure>();
	const dimensions = new Map<string, StatisticsDimension>();
	for (const dataset of STATISTICS_DATASETS) {
		for (const measure of dataset.measures)
			measures.set(measure.slug, measure);
		for (const dimension of dataset.dimensions ?? []) {
			if (!dimension.members) continue;
			const codes = new Map(
				dimension.members.map((member) => [
					member.key,
					member.code ?? member.key,
				]),
			);
			dimensions.set(dimension.slug, {
				slug: dimension.slug,
				label: dimension.label,
				members: dimension.members.map((member) => ({
					code: member.code ?? member.key,
					label: member.label ?? member.key,
					...(member.parent === undefined
						? {}
						: { parent: codes.get(member.parent)! }),
				})),
			});
		}
	}
	return { measures, dimensions };
};

const census2021 = () => {
	const config = STATISTICS_DATASETS.find(
		(dataset) => dataset.type === "ethnicity",
	);
	if (!config?.period)
		throw new Error("The ethnicity dataset declares no census period");
	return config.period("2021", {});
};

export function censusSmallAreaStatistics(
	repositoryRoot: string,
	tables: readonly CensusTable[] = CENSUS_SMALL_AREA_TABLES,
): StatisticsInput[] {
	if (tables.length === 0) return [];
	const { config } = readMeasureDimensionsConfig(apiRootOf(repositoryRoot));
	const stored = declared();
	const period = census2021();
	return tables.map((table) => (areas: AreaIndex): StatisticsDataset => {
		const slug = `census-2021-${table.table}`;
		const directory = join(
			repositoryRoot,
			"data/source",
			CENSUS_SMALL_AREA_DIRECTORY,
			table.table,
		);
		const meta = JSON.parse(
			readFileSync(join(directory, "meta.json"), "utf8"),
		) as Meta;
		const files = CENSUS_SMALL_AREA_GEOGRAPHIES.map((geography) => ({
			geography,
			path: join(
				directory,
				`census2021-${table.table}-${geography.type}.csv`,
			),
		}));
		const fingerprint = createHash("sha256");
		for (const { path } of files) fingerprint.update(readFileSync(path));

		const columns = table.categories.map(([suffix]) => {
			const id = `${table.measurePrefix}-${suffix}`;
			const mapping = config.ids[id];
			if (!mapping)
				throw new Error(`${slug}: ${id} has no measure mapping`);
			const measure = stored.measures.get(mapping.measure);
			if (!measure)
				throw new Error(
					`${slug}: ${mapping.measure} is not a stored measure`,
				);
			return { measure, members: mapping.dimensions ?? {} };
		});

		const dimensions: StatisticsDimension[] = [];
		for (const slugOf of new Set(
			columns.flatMap(({ members }) => Object.keys(members)),
		)) {
			const extra = config.members[slugOf] ?? [];
			const own = stored.dimensions.get(slugOf);
			const mapped = config.dimensions[slugOf];
			if (own && extra.length > 0)
				dimensions.push({
					...own,
					members: [...own.members, ...extra],
				});
			else if (!own && mapped)
				dimensions.push({
					slug: slugOf,
					label: mapped.label,
					members: mapped.members,
				});
			// Otherwise every member is stored already, by its own dataset.
		}

		const releases = files.map(({ geography }) =>
			areas.release(geography.type, BOUNDARY_YEAR),
		);
		const series: StatisticsSeries[] = releases.flatMap((release) =>
			columns.map(({ measure, members }) => ({
				measure: measure.slug,
				release,
				...(Object.keys(members).length > 0 ? { members } : {}),
			})),
		);
		return {
			slug,
			title: meta.title,
			description: meta.description,
			source: {
				publisher: meta.publisher,
				url: meta.sourceUrl,
				licence: meta.licence.name,
				...(meta.licence.url ? { licenceUrl: meta.licence.url } : {}),
			},
			fingerprint: `sha256:${fingerprint.digest("hex")}`,
			measures: [
				...new Map(
					columns.map(({ measure }) => [measure.slug, measure]),
				).values(),
			],
			...(dimensions.length > 0 ? { dimensions } : {}),
			periods: [period],
			series,
			*observations() {
				for (const [index, { geography, path }] of files.entries())
					for (const [code, ...values] of censusTableRecords(
						path,
						table,
						geography,
					))
						for (const [column, value] of values.entries())
							yield {
								series: index * columns.length + column,
								code,
								period: period.label,
								value,
							};
			},
		};
	});
}
