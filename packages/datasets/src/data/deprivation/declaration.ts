import type { BoundaryType } from "../boundaries/catalog.ts";
import type { DeclaredStatistics } from "../../declaration/dataset.ts";
import type {
	DatasetDisplay,
	DisplayMeasure,
} from "../../declaration/display.ts";
import { measure, POPULATION } from "../../declaration/measures.ts";
import type { DeclaredField, Json } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";

/**
 * The four national deprivation indices are published in one shape: a record
 * for each small area, naming the council it lies in, with the rank (and for
 * most, the decile or score) the publisher gives it. What differs is the index,
 * its fields and its source text, so the shared parts are written once here.
 */

type Rows = Record<string, Json>[];

type IndexFields = {
	score?: boolean;
	quintile?: boolean;
	decile?: boolean;
	population?: boolean;
};

/** The measures and fields of one index, each named after its record field prefix. */
const measuresOf = (
	prefix: string,
	index: string,
	area: string,
	fields: IndexFields,
) => ({
	measures: [
		...(fields.score
			? [
					measure(
						`${prefix}-score`,
						`${index} score`,
						"score",
						"index",
						"none",
						`${index} score; higher is more deprived.`,
					),
				]
			: []),
		measure(
			`${prefix}-rank`,
			`${index} rank`,
			"rank",
			"rank",
			"none",
			`Rank of ${area} by the ${index}, where 1 is the most deprived.`,
		),
		...(fields.quintile
			? [
					measure(
						`${prefix}-quintile`,
						`${index} quintile`,
						"quintile",
						"index",
						"none",
						`Fifth of ${area} by the ${index}, where 1 is the most deprived.`,
					),
				]
			: []),
		...(fields.decile
			? [
					measure(
						`${prefix}-decile`,
						`${index} decile`,
						"decile",
						"index",
						"none",
						`Tenth of ${area} by the ${index}, where 1 is the most deprived.`,
					),
				]
			: []),
		...(fields.population ? [POPULATION] : []),
	],
	fields: [
		...(fields.score
			? [{ path: `${prefix}Score`, measure: `${prefix}-score` }]
			: []),
		{ path: `${prefix}Rank`, measure: `${prefix}-rank` },
		...(fields.quintile
			? [{ path: `${prefix}Quintile`, measure: `${prefix}-quintile` }]
			: []),
		...(fields.decile
			? [{ path: `${prefix}Decile`, measure: `${prefix}-decile` }]
			: []),
		...(fields.population
			? [{ path: "population", measure: "population" }]
			: []),
	] as DeclaredField[],
});

export type DeprivationStatisticsOptions = {
	id: string;
	/** The prefix of the record fields: `imd` for `imdScore`, `imdRank`. */
	prefix: string;
	/** The index's name in measure descriptions. */
	index: string;
	/** What the index ranks, in measure descriptions. */
	area: string;
	fields: IndexFields;
	boundary: { type: BoundaryType; year: number };
	/** The edition, which is also the payload's only key. */
	edition: string;
	metadata: { source: string; notes: string[] };
	/** Record fields holding the area's code and name. */
	code: string;
	name: string;
	/** The council each area lies in. */
	parent: { code: string; name: string };
	/** Header field holding the summary of the areas inside each council. */
	summaryField: string;
	/** Whether a record is among the most deprived tenth. */
	mostDeprived: (record: Record<string, Json>) => boolean;
	/** The record fields to average by population, `score` first. */
	weighted?: { score: string; domains?: string[] };
};

/**
 * The statistics half of a deprivation index: its one part, with a summary of
 * the areas inside each council its records name, computed from the records.
 * `weighted` makes the summary population weighted.
 */
export const deprivationStatistics = (
	options: DeprivationStatisticsOptions,
): Pick<DeclaredStatistics, "measures" | "fields" | "name" | "parents"> & {
	payload: DeclaredStatistics["payload"];
} => {
	const { measures, fields } = measuresOf(
		options.prefix,
		options.index,
		options.area,
		options.fields,
	);
	return {
		measures,
		fields,
		name: options.name,
		parents: [
			{
				code: options.parent.code,
				name: options.parent.name,
				release: { geography: "localAuthority", year: 2024 },
			},
		],
		payload: {
			parts: yearParts(
				options.id,
				options.boundary.type,
				options.boundary.year,
				{ metadata: options.metadata },
				[options.edition],
			),
			code: options.code,
			summary: (records) => {
				const groups = new Map<string, Rows>();
				for (const found of Object.values(records)) {
					const record = found as Record<string, Json>;
					const parent = String(record[options.parent.code]);
					const rows = groups.get(parent) ?? [];
					rows.push(record);
					groups.set(parent, rows);
				}
				const { weighted } = options;
				const average = (
					rows: Rows,
					field: string,
					population: number,
				) =>
					rows.reduce(
						(sum, row) =>
							sum +
							(row[field] as number) * (row.population as number),
						0,
					) / population;
				return {
					[options.summaryField]: Object.fromEntries(
						[...groups].map(([parent, rows]) => {
							const population = weighted
								? rows.reduce(
										(sum, row) =>
											sum + (row.population as number),
										0,
									)
								: 0;
							return [
								parent,
								{
									areaCount: rows.length,
									mostDeprivedCount: rows.filter(
										options.mostDeprived,
									).length,
									...(weighted
										? {
												population,
												averageScore: average(
													rows,
													weighted.score,
													population,
												),
											}
										: {}),
									...(weighted?.domains
										? {
												domainScores:
													Object.fromEntries(
														weighted.domains.map(
															(field) => [
																field,
																average(
																	rows,
																	field,
																	population,
																),
															],
														),
													),
											}
										: {}),
								},
							];
						}),
					),
				};
			},
		},
	};
};

/**
 * The display of a rank-only index: one measure, the rank, with 1 as the most
 * deprived. Ranks run low to high on the colour scale, so the legend reads
 * them back as "Rank n" between its two ends.
 */
export const rankDisplay = ({
	prefix,
	label,
	year,
	areaCount,
	aggregation,
}: {
	prefix: string;
	label: string;
	year: number;
	areaCount: number;
	aggregation: DatasetDisplay["aggregation"];
}): DatasetDisplay => ({
	label,
	year,
	component: `@/components/datasets/society/deprivation/${prefix}/${prefix.toUpperCase()}Chart`,
	measures: [
		{
			id: "rank",
			label: "Rank",
			field: `${prefix}Rank`,
			colorRange: { min: 1, max: areaCount },
			legend: {
				min: 1,
				max: areaCount,
				format: { kind: "rank", of: areaCount },
			},
			invertColor: false,
		} satisfies DisplayMeasure,
	],
	aggregation,
});
