import { CASE_SLUGS, type CaseHop, type CaseSeries } from "./backtestCases.ts";
import type { ConversionBasis } from "./crosswalkSteps.ts";

/**
 * The series that are converted, each with the route it takes pinned by slug.
 *
 * A measure is listed here only where its rule in `rules.ts` allows the
 * conversion and the backtest in `backtestCases.ts` has measured the route's
 * kind. Everything else stays unconverted.
 */

export type PlanEntry = {
	id: string;
	source: CaseSeries;
	/** `geography:release` the series is converted onto. */
	target: string;
	route: CaseHop[];
	/** The weight basis of any split on the route. Population unless set. */
	basis?: ConversionBasis;
	/** Only source series whose members match. */
	members?: RegExp;
	/**
	 * Keep values that passed through a split, with bounds from the backtest.
	 * Without it only exact regroupings are kept and a split value is a gap.
	 */
	estimates?: boolean;
	/** What a reader of the series must know about it. Stored beside it. */
	note?: string;
};

const LA = (release: string) => `localAuthority:${release}`;
const LA_LATEST = LA("2026-05-uk-bgc");
const WARD_2023 = "ward:2023-12-uk-bgc";
const WARD_LATEST = "ward:2026-05-uk-bgc";
const CON_2024 = "constituency:2024-07-uk-bgc";
const LSOA = "lsoa:2021-12-ew-bgc-v5";

const hop = (...crosswalks: string[]): CaseHop => ({ crosswalks });
const la = CASE_SLUGS.la;

const laFrom2023 = [
	hop(la["2023-12>2024-05"]),
	hop(la["2024-05>2024-12"]),
	hop(la["2024-12>2025-05"]),
	hop(la["2025-05>2025-12"], CASE_SLUGS.la2025MayToDecPostcodes),
	hop(la["2025-12>2026-05"]),
];
const laFrom2024 = laFrom2023.slice(1);
const laFrom2025 = laFrom2023.slice(3);
const lsoaToLa = [
	hop(CASE_SLUGS.lsoaToLa2023),
	hop(la["2023-05>2023-12"]),
	...laFrom2023,
];

const wardStep = (from: string, to: string) =>
	hop(`ward-${from}-to-${to}-extent-continuity`);
const wardFrom2023 = [
	wardStep("2023-12-uk-bgc", "2024-05-uk-bgc"),
	wardStep("2024-05-uk-bgc", "2024-12-uk-bgc"),
	wardStep("2024-12-uk-bgc", "2025-05-uk-bgc-v2"),
	wardStep("2025-05-uk-bgc-v2", "2025-12-uk-bgc"),
	wardStep("2025-12-uk-bgc", "2026-05-uk-bgc"),
];

const CENSUS_NOTE =
	"A sum of census counts for small areas, each perturbed by the publisher's disclosure control. It is not the figure the census publishes for the authority, and differs from it by the noise the backtest measures.";
const FUEL_POVERTY_NOTE =
	"A sum of the published small area estimates, which are modelled. England only.";

const onLatestLa = (
	dataset: string,
	measure: string,
	from: string,
	route: CaseHop[],
	rest: Partial<PlanEntry> = {},
): PlanEntry => ({
	id: `${dataset}/${measure}>la`,
	source: { dataset, measure, release: from },
	target: LA_LATEST,
	route,
	...rest,
});

/** Persons only. The breakdown by sex triples the size for little interest. */
const PERSONS = /(^|\/)sex=all$/;

export const CONVERTED_PLAN: PlanEntry[] = [
	onLatestLa(
		"population-uk",
		"population",
		LA("2023-12-uk-bgc"),
		laFrom2023,
		{
			members: PERSONS,
		},
	),
	onLatestLa("jobs", "total-jobs", LA("2023-12-uk-bgc"), laFrom2023),
	...(
		[
			["ghg-emissions", "ghg-emissions"],
			["ghg-emissions", "ghg-population"],
			["electricity-consumption", "electricity-consumption"],
			["electricity-consumption", "electricity-meters"],
			["gas-consumption", "gas-consumption"],
			["gas-consumption", "gas-meters"],
		] as const
	).map(([dataset, measure]) =>
		onLatestLa(dataset, measure, LA("2025-05-uk-bgc-v2"), laFrom2025),
	),
	...(
		[
			["unemployment", "unemployed-people"],
			["child-poverty", "children-in-relative-low-income"],
			["school-performance", "key-stage-4-pupils"],
			// Means and shares, each rebuilt over the count it names as its weight.
			["school-performance", "gcse-english-maths-grade-4"],
			["school-performance", "gcse-english-maths-grade-5"],
			["school-performance", "attainment-8"],
			["broadband", "broadband-availability"],
			["mobile-coverage", "mobile-premises-coverage"],
		] as const
	).map(([dataset, measure]) =>
		onLatestLa(dataset, measure, LA("2024-05-uk-bgc"), laFrom2024),
	),
	onLatestLa("census-2021-ts001", "usual-residents", LSOA, lsoaToLa, {
		note: CENSUS_NOTE,
	}),
	onLatestLa("census-2021-ts003", "households", LSOA, lsoaToLa, {
		note: CENSUS_NOTE,
	}),
	...["fuel-poor-households", "households", "fuel-poverty-rate"].map(
		(measure) =>
			onLatestLa("fuel-poverty", measure, LSOA, lsoaToLa, {
				note: FUEL_POVERTY_NOTE,
			}),
	),
	{
		id: "population/population>constituency",
		source: {
			dataset: "population",
			measure: "population",
			release: WARD_2023,
		},
		target: CON_2024,
		route: [hop(CASE_SLUGS.ward2023ToCon2024Overlap)],
		members: PERSONS,
		note: "Only constituencies made of whole wards have a value. A breakdown by age is not split.",
	},
	{
		id: "population/population>ward",
		source: {
			dataset: "population",
			measure: "population",
			release: WARD_2023,
		},
		target: WARD_LATEST,
		route: wardFrom2023,
		members: PERSONS,
		note: "Only wards whose boundary has not changed since 2023 have a value.",
	},
	{
		id: "population-constituency/population>la",
		source: {
			dataset: "population-constituency",
			measure: "population",
			release: CON_2024,
		},
		target: LA_LATEST,
		route: [hop(...CASE_SLUGS.con2024ToLa2024), ...laFrom2024],
		estimates: true,
		note: "Constituency population split onto authorities by residents in the overlap, the one estimated split kept. The population-uk series is the published authority figure and is the better one wherever it exists. The bounds are the backtest's.",
	},
];
