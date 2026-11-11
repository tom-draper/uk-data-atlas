import { measure } from "../../declaration/measures.ts";
import {
	periods,
	type DeclaredField,
	type DerivedRule,
} from "../../declaration/statistics.ts";
/** The count the shares and the Attainment 8 average are taken over. */
const OVER_PUPILS = { weight: "key-stage-4-pupils" };

// Progress 8 names no weight. It is averaged over the pupils who have a key
// stage 2 result, and that count is not published here.
export const SCHOOL_MEASURES = [
	measure(
		"key-stage-4-pupils",
		"Key stage 4 pupils",
		"pupils",
		"count",
		"sum",
		"Pupils at the end of key stage 4.",
	),
	measure(
		"gcse-english-maths-grade-4",
		"English and maths at grade 4 or above",
		"percent of pupils",
		"share",
		"weighted_mean",
		"Key stage 4 pupils achieving grade 4 or above in English and maths.",
		OVER_PUPILS,
	),
	measure(
		"gcse-english-maths-grade-5",
		"English and maths at grade 5 or above",
		"percent of pupils",
		"share",
		"weighted_mean",
		"Key stage 4 pupils achieving grade 5 or above in English and maths.",
		OVER_PUPILS,
	),
	measure(
		"attainment-8",
		"Average Attainment 8 score",
		"score",
		"mean",
		"weighted_mean",
		"Average Attainment 8 score of key stage 4 pupils.",
		OVER_PUPILS,
	),
	measure(
		"progress-8",
		"Average Progress 8 score",
		"score",
		"mean",
		"weighted_mean",
		"Average Progress 8 score of key stage 4 pupils.",
	),
];

/** Series keys are the year an academic year ends. */
export const schoolYear = (key: string) =>
	periods.academicYear(Number(key) - 1);

export const schoolFields = (prefix: string): DeclaredField[] =>
	[
		["ptL2basics94", "gcse-english-maths-grade-4"],
		["ptL2basics95", "gcse-english-maths-grade-5"],
		["avgAtt8", "attainment-8"],
		["avgP8score", "progress-8"],
		["pupils", "key-stage-4-pupils"],
	].map(([field, measure]) => ({
		path: `${prefix}${field}`,
		measure,
		period: schoolYear,
	}));

export const latestCopies = (fields: string[]) =>
	Object.fromEntries(
		fields.map((field) => [field, "Copy of the latest year in series."]),
	);

/** Each top-level field read back from the latest year in `series`. */
export const latestCopyRules = (
	fields: string[],
): Record<string, DerivedRule> =>
	Object.fromEntries(
		fields.map((field) => [
			field,
			(record) => {
				const series = record.series as Record<
					string,
					Record<string, number | null>
				>;
				// Integer keys iterate in ascending order.
				return series[Object.keys(series).at(-1)!][field];
			},
		]),
	);

export const SCHOOL_COPIES = [
	"ptL2basics94",
	"ptL2basics95",
	"avgAtt8",
	"avgP8score",
	"pupils",
];

/** Keys of a school year's results: the year it ends. */
export const schoolYears = Array.from({ length: 12 }, (_, index) =>
	String(2015 + index),
);
