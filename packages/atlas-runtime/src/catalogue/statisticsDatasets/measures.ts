import type {
	Aggregation,
	StatisticsMeasure,
	ValueKind,
} from "../atlasStatistics";
import type {
	DeclaredDataset,
	DeclaredDimension,
	Json,
} from "../declaredStatistics";

/**
 * Measures shared by several datasets. A slug means one thing everywhere, and
 * the build refuses two different declarations of it, so shared ones live
 * here.
 */

export const measure = (
	slug: string,
	label: string,
	unit: string,
	valueKind: ValueKind,
	aggregation: Aggregation,
	description: string,
	ratio?: { numerator: string; denominator: string },
): StatisticsMeasure => ({
	slug,
	label,
	description,
	unit,
	valueKind,
	aggregation,
	...ratio,
});

export const HOUSEHOLDS = measure(
	"households",
	"Households",
	"households",
	"count",
	"sum",
	"Number of households.",
);

export const USUAL_RESIDENTS = measure(
	"usual-residents",
	"Usual residents",
	"people",
	"count",
	"sum",
	"Usual residents counted by the census.",
);

export const POPULATION = measure(
	"population",
	"Population",
	"people",
	"count",
	"sum",
	"Mid-year population estimate.",
);

export const LIFE_EXPECTANCY = measure(
	"life-expectancy",
	"Life expectancy at birth",
	"years",
	"mean",
	"none",
	"Average years a newborn would live at the period's mortality rates.",
);

type Records = { readonly [key: string]: Json };

/**
 * The per-100,000-residents figure the compilers add from the population
 * estimate: `value` over the area's mid-year population in population-uk, for
 * `year` or else the part's year. Mirrors `addPopulationMetrics`, so the sum
 * runs over the ages in the same order.
 */
export const per100k = (
	value: (record: Records) => Json,
	year?: number,
): Pick<DeclaredDataset, "derived" | "rebuild"> => ({
	derived: {
		"metrics.per100kPopulation":
			"Computed by the compiler from the mid-year population estimate.",
	},
	rebuild: {
		derived: {
			"metrics.per100kPopulation": (record, _path, context) => {
				const part = context.dataset("population-uk")[
					String(year ?? context.header.year)
				] as Records | undefined;
				const area = (part?.data as Records | undefined)?.[
					context.code
				] as Records | undefined;
				const total = Object.values(
					(area?.total ?? {}) as Records,
				).reduce<number>((sum, count) => sum + (count as number), 0);
				return total > 0
					? ((value(record) as number) / total) * 100_000
					: null;
			},
		},
	},
});

export const PREMISES = measure(
	"premises",
	"Premises",
	"premises",
	"count",
	"sum",
	"Residential and business premises.",
);

export const SEX: DeclaredDimension = {
	slug: "sex",
	label: "Sex",
	members: [
		{ key: "all", label: "All people" },
		{ key: "male", label: "Male", parent: "all" },
		{ key: "female", label: "Female", parent: "all" },
	],
};

export const ELECTORATE = measure(
	"electorate",
	"Electorate",
	"electors",
	"count",
	"sum",
	"People registered to vote.",
);

export const VALID_VOTES = measure(
	"valid-votes",
	"Valid votes",
	"votes",
	"count",
	"sum",
	"Ballots counted as valid.",
);

export const REJECTED_BALLOTS = measure(
	"rejected-ballots",
	"Rejected ballots",
	"ballots",
	"count",
	"sum",
	"Ballots rejected at the count.",
);

export const TURNOUT = measure(
	"turnout",
	"Turnout",
	"percent",
	"share",
	"weighted_mean",
	"Ballots cast as a percentage of the electorate.",
);
