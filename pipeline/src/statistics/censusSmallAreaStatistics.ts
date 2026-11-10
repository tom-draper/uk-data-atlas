import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type StatisticsDimension,
	type StatisticsMeasure,
} from "@uk-data-atlas/measures";
import {
	STATISTICS_DATASETS,
	readMeasureDimensionsMapping,
	type AreaIndex,
	type StatisticsDataset,
	type StatisticsInput,
	type StatisticsSeries,
} from "@uk-data-atlas/measures";
import {
	CENSUS_SMALL_AREA_DIRECTORY,
	CENSUS_SMALL_AREA_GEOGRAPHIES,
	CENSUS_SMALL_AREA_TABLES,
	censusTableRecords,
	type CensusTable,
} from "../catalog/censusSmallArea.ts";
import { readJsonSync } from "../lib/json.ts";

/**
 * The census small-area tables as statistics rows: one dataset per table,
 * one series per category and geography, named by the measure and members
 * the API's measure mapping gives each category's measure id.
 *
 * Measures, and dimensions whose members another dataset declares in full,
 * are those datasets' own, so these datasets must follow the declared ones.
 * Dimensions and members only these tables publish are declared below.
 */

/**
 * Dimensions only these tables publish, as the mapping declared them before
 * they were stored: five-year age bands (TS007a), residence type (TS001),
 * household composition (TS003) and economic activity (TS066).
 */
const CENSUS_DIMENSIONS: StatisticsDimension[] = [
	{
		slug: "age-band",
		label: "Age band",
		members: [
			{ code: "0-to-4", label: "Aged 4 and under" },
			{ code: "5-to-9", label: "Aged 5 to 9" },
			{ code: "10-to-14", label: "Aged 10 to 14" },
			{ code: "15-to-19", label: "Aged 15 to 19" },
			{ code: "20-to-24", label: "Aged 20 to 24" },
			{ code: "25-to-29", label: "Aged 25 to 29" },
			{ code: "30-to-34", label: "Aged 30 to 34" },
			{ code: "35-to-39", label: "Aged 35 to 39" },
			{ code: "40-to-44", label: "Aged 40 to 44" },
			{ code: "45-to-49", label: "Aged 45 to 49" },
			{ code: "50-to-54", label: "Aged 50 to 54" },
			{ code: "55-to-59", label: "Aged 55 to 59" },
			{ code: "60-to-64", label: "Aged 60 to 64" },
			{ code: "65-to-69", label: "Aged 65 to 69" },
			{ code: "70-to-74", label: "Aged 70 to 74" },
			{ code: "75-to-79", label: "Aged 75 to 79" },
			{ code: "80-to-84", label: "Aged 80 to 84" },
			{ code: "85-plus", label: "Aged 85 and over" },
		],
	},
	{
		slug: "economic-activity",
		label: "Economic activity status",
		members: [
			{ code: "total", label: "Usual residents aged 16 and over" },
			{
				code: "employed",
				label: "In employment, excluding full-time students",
				parent: "total",
			},
			{
				code: "inactive-long-term-sick",
				label: "Economically inactive: long-term sick or disabled",
				parent: "total",
			},
			{
				code: "inactive-looking-after-home",
				label: "Economically inactive: looking after home or family",
				parent: "total",
			},
			{
				code: "inactive-other",
				label: "Economically inactive: other",
				parent: "total",
			},
			{
				code: "inactive-retired",
				label: "Economically inactive: retired",
				parent: "total",
			},
			{
				code: "inactive-student",
				label: "Economically inactive: student",
				parent: "total",
			},
			{
				code: "student-employed",
				label: "Full-time student in employment",
				parent: "total",
			},
			{
				code: "student-unemployed",
				label: "Full-time student, unemployed",
				parent: "total",
			},
			{
				code: "unemployed",
				label: "Unemployed, excluding full-time students",
				parent: "total",
			},
		],
	},
	{
		slug: "household-composition",
		label: "Household composition",
		members: [
			{ code: "total", label: "Households" },
			{
				code: "cohabiting-dependent-children",
				label: "Cohabiting couple, dependent children",
				parent: "total",
			},
			{
				code: "cohabiting-no-children",
				label: "Cohabiting couple, no children",
				parent: "total",
			},
			{
				code: "cohabiting-non-dependent-children",
				label: "Cohabiting couple, all children non-dependent",
				parent: "total",
			},
			{
				code: "family-all-66-plus",
				label: "Single family household, all aged 66 or over",
				parent: "total",
			},
			{
				code: "lone-parent-dependent-children",
				label: "Lone parent, dependent children",
				parent: "total",
			},
			{
				code: "lone-parent-non-dependent-children",
				label: "Lone parent, all children non-dependent",
				parent: "total",
			},
			{
				code: "married-dependent-children",
				label: "Married or civil partnership couple, dependent children",
				parent: "total",
			},
			{
				code: "married-no-children",
				label: "Married or civil partnership couple, no children",
				parent: "total",
			},
			{
				code: "married-non-dependent-children",
				label: "Married or civil partnership couple, all children non-dependent",
				parent: "total",
			},
			{
				code: "one-person-66-plus",
				label: "One-person household aged 66 or over",
				parent: "total",
			},
			{
				code: "one-person-other",
				label: "One-person household, other",
				parent: "total",
			},
			{
				code: "other",
				label: "Other household type, including all full-time students",
				parent: "total",
			},
			{
				code: "other-family",
				label: "Other single family household",
				parent: "total",
			},
			{
				code: "other-with-dependent-children",
				label: "Other household type with dependent children",
				parent: "total",
			},
		],
	},
	{
		slug: "residence-type",
		label: "Residence type",
		members: [
			{ code: "total", label: "Usual residents" },
			{
				code: "communal-establishment",
				label: "Usual residents living in communal establishments",
				parent: "total",
			},
			{
				code: "household",
				label: "Usual residents living in households",
				parent: "total",
			},
		],
	},
];

/**
 * Tenure members finer than the housing tenure dataset's, from TS054, added
 * after its members so their positions are unchanged.
 */
const CENSUS_MEMBERS: Readonly<Record<string, StatisticsDimension["members"]>> =
	{
		tenure: [
			{
				code: "private-rented-landlord",
				label: "Private rented from a landlord or letting agency",
				parent: "private-rented",
			},
			{
				code: "private-rented-other",
				label: "Other private rented",
				parent: "private-rented",
			},
			{
				code: "social-rented-council",
				label: "Social rented from a council",
				parent: "social-rented",
			},
			{
				code: "social-rented-other",
				label: "Other social rented",
				parent: "social-rented",
			},
		],
	};

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
	const config = readMeasureDimensionsMapping(repositoryRoot);
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
		const meta = readJsonSync(join(directory, "meta.json")) as Meta;
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
			const extra = CENSUS_MEMBERS[slugOf] ?? [];
			const own = stored.dimensions.get(slugOf);
			const census = CENSUS_DIMENSIONS.find(
				(dimension) => dimension.slug === slugOf,
			);
			if (own && extra.length > 0)
				dimensions.push({
					...own,
					members: [...own.members, ...extra],
				});
			else if (census) dimensions.push(census);
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
			module: table.module,
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
