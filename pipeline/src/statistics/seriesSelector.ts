import type { DatabaseSync } from "node:sqlite";
import {
	totalMember,
	type MeasureSeriesIdentity,
	type StatisticsSelector,
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";
import {
	HOUSE_PRICE_SERVED_WARD_CODES,
	SALFORD_WARD_CODE_REMAP,
	SERVED_LOCAL_ELECTION_WARD_CODES,
	SERVED_WARD_CODES_UNTIL,
} from "@uk-data-atlas/datasets";

/** The dimensions each statistics series of a dataset and measure carries. */
export const seriesDimensions = (
	database: DatabaseSync,
	datasetId: string,
	measure: string,
	geography: string,
) =>
	database
		.prepare(
			"SELECT s.id, group_concat(d.slug) AS dimensions FROM series s JOIN dataset ds ON ds.id = s.dataset_id JOIN measure m ON m.id = s.measure_id JOIN area_release r ON r.id = s.release_id LEFT JOIN series_member sm ON sm.series_id = s.id LEFT JOIN dimension d ON d.id = sm.dimension_id WHERE ds.slug = ? AND m.slug = ? AND r.geography = ? AND s.method = 'published' GROUP BY s.id",
		)
		.all(datasetId, measure, geography)
		.map((row) =>
			row.dimensions === null ? [] : String(row.dimensions).split(","),
		);

/**
 * Measures the API serves that the statistics tables hold as parts of
 * another: a party's vote share is its votes over the valid votes, a local
 * election's effective votes are every party's votes summed, and population
 * density is population over land area.
 */
const COMPUTED: Record<
	string,
	Pick<StatisticsSelector, "measure" | "ratio" | "plus" | "status">
> = {
	// Residents per square kilometre of land, from the 2024 land area.
	"population-density": {
		measure: "population",
		ratio: {
			datasetId: "land-area",
			measure: "area",
			dimensions: { surface: "land" },
			period: "2024",
			denominatorDivisor: 100,
			scale: 1,
			scaleQuotient: true,
		},
		status: "derived",
	},
	"party-vote-share": {
		measure: "party-votes",
		ratio: { measure: "valid-votes", scale: 100 },
	},
	"effective-votes": { measure: "party-votes" },
};

/**
 * Measures a dataset derives from its other measures rather than storing:
 * a general election's turnout is its valid votes and rejected ballots as a
 * percentage of the electorate.
 */
const DERIVED: Record<
	string,
	Record<
		string,
		Pick<StatisticsSelector, "measure" | "ratio" | "plus" | "status">
	>
> = {
	"general-election": {
		turnout: {
			measure: "valid-votes",
			plus: ["rejected-ballots"],
			ratio: { measure: "electorate", scale: 100, scaleQuotient: true },
		},
	},
};

/**
 * Measures published with the half-width of their confidence interval as a
 * measure of its own, rounded as the publisher gives the value.
 */
const HALF_WIDTHS: Record<string, StatisticsSelector["halfWidth"]> = {
	"unemployment-rate": { measure: "unemployment-rate-interval", digits: 1 },
	"unemployed-people": { measure: "unemployed-people-interval", digits: 1 },
};

/** Measures where an area with no row in a contest polled nothing. */
const ABSENT_AS_ZERO = new Set(["party-votes"]);

/**
 * The codes a dataset serves in place of those its rows are stored under,
 * as the observation artifacts were built.
 */
export const servedCodesFor = (
	datasetId: string,
	boundaryYear: number,
): StatisticsSelector["servedCodes"] => {
	if (
		datasetId === "local-election" &&
		boundaryYear < SERVED_WARD_CODES_UNTIL
	)
		return Object.fromEntries(
			[...SERVED_LOCAL_ELECTION_WARD_CODES].map(([source, served]) => [
				source,
				{ areaCode: served, sourceAreaCode: source },
			]),
		);
	if (datasetId === "house-price")
		return Object.fromEntries([
			...Object.entries(SALFORD_WARD_CODE_REMAP).map(
				([published, compiled]) => [compiled, { areaCode: published }],
			),
			...[...HOUSE_PRICE_SERVED_WARD_CODES].map(([source, served]) => [
				source,
				{ areaCode: served, sourceAreaCode: source },
			]),
		]);
	return undefined;
};

/**
 * The series an artifact would be read from. A dimension the mapping leaves
 * open is fixed at its total where it has one, and summed over otherwise.
 */
export const selectorFor = (
	database: DatabaseSync,
	vocabulary: StatisticsVocabulary,
	mapping: MeasureSeriesIdentity,
	datasetId: string,
	geography: string,
	boundaryYear: number,
): StatisticsSelector | string => {
	if (mapping.measure === "winning-party") {
		// The winner is stored as text on each contest, not as a series.
		const servedCodes = servedCodesFor(datasetId, boundaryYear);
		return {
			datasetId,
			measure: mapping.measure,
			dimensions: {},
			geography,
			contest: "winner",
			...(servedCodes ? { servedCodes } : {}),
		};
	}
	const computed =
		DERIVED[datasetId]?.[mapping.measure] ?? COMPUTED[mapping.measure];
	const measure = computed?.measure ?? mapping.measure;
	if (!(measure in vocabulary.measures))
		return `${mapping.measure} is not in the statistics tables.`;
	for (const dimension of Object.keys(mapping.dimensions ?? {}))
		if (!(dimension in vocabulary.dimensions))
			return `The ${dimension} dimension is not in the statistics tables.`;
	const held = seriesDimensions(database, datasetId, measure, geography);
	if (held.length === 0)
		return `The statistics tables hold no ${measure} series from ${datasetId} on ${geography}.`;
	const dimensions = { ...(mapping.dimensions ?? {}) };
	const sum: string[] = [];
	for (const dimension of new Set(held.flat())) {
		if (dimension in dimensions) continue;
		const total = totalMember(vocabulary.dimensions[dimension]!.members);
		if (total) dimensions[dimension] = total;
		else sum.push(dimension);
	}
	const servedCodes = servedCodesFor(datasetId, boundaryYear);
	return {
		datasetId,
		measure,
		dimensions,
		geography,
		...(sum.length > 0 ? { sum: sum.sort() } : {}),
		...(ABSENT_AS_ZERO.has(measure) && sum.length === 0
			? { absentAsZero: true as const }
			: {}),
		...(servedCodes ? { servedCodes } : {}),
		...(HALF_WIDTHS[measure] ? { halfWidth: HALF_WIDTHS[measure] } : {}),
		...(computed?.plus ? { plus: computed.plus } : {}),
		...(computed?.ratio ? { ratio: computed.ratio } : {}),
		...(computed?.status ? { status: computed.status } : {}),
	};
};
