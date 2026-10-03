import type { CrimeDataset } from "@/lib/types/crime";
import type { HousePriceDataset } from "@/lib/types/housePrice";
import type { IncomeDataset } from "@/lib/types/income";
import type { LandAreaDataset } from "@/lib/types/landArea";
import type { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import type { PopulationUkDataset } from "@/lib/types/population";
import {
	ATLAS_LOCATIONS,
	type AtlasLocation,
	atlasMapCovers,
	findAtlasMap,
	locationLabel,
} from "@/lib/atlas/pages";

/**
 * A headline figure for each place on the most searched maps, written into
 * the page's search snippet. Figures are compiled from the committed
 * datasets by `pnpm figures:build`, because the datasets are far too large
 * to load while rendering a page.
 *
 * Each figure is one the data supports for the whole place: a total, a rate
 * from totals, a value published for that exact place, or else the range
 * across its areas. A place is left without a figure when any of its areas
 * is missing from the data, rather than described from part of it.
 */

export type Extreme = { name: string; value: number };

export type MapFigure =
	| { kind: "density"; population: number; areaKm2: number }
	| { kind: "crime"; crimes: number; population: number; period: string }
	| { kind: "value"; value: number }
	| { kind: "sexes"; male: number; female: number }
	| { kind: "range"; low: Extreme; high: Extreme }
	| { kind: "percent"; percent: number }
	/** A total, with a rate where the data gives its denominator. */
	| { kind: "count"; count: number; rate?: number; period?: string };

/** Figures by map slug, then location slug. */
export type MapFigures = Record<string, Record<string, MapFigure>>;

export type FigureInputs = {
	populationUk: Record<string, PopulationUkDataset>;
	landArea: Record<string, LandAreaDataset>;
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	lifeExpectancy: Record<string, LifeExpectancyDataset>;
	income: Record<string, IncomeDataset>;
	childPoverty: Editions<{
		ladName: string;
		childCount: number;
		childrenPopulation: number;
	}>;
	broadband: Editions<{ pctFullFibre: number; premisesCount: number }>;
	mobileCoverage: Editions<{
		pct5GOutdoorAll: number;
		premisesCount: number;
	}>;
	businessActivity: Editions<{ value: number }>;
	electricVehicleChargers: Editions<{ value: number }>;
	councilTax: Editions<{ name: string; value: number }>;
	claimantCount: Editions<
		{ totalCount: number; totalRate: number },
		{ month: string }
	>;
	homelessness: Editions<
		{
			householdsInTemporaryAccommodation: number;
			householdsPerThousand: number;
		},
		{ quarter: string }
	>;
	ghgEmissions: Editions<{
		totalKtCO2e: number;
		populationThousands: number;
	}>;
};

/** A compiled dataset's editions, keyed by year, as far as the figures read them. */
type Editions<Row, Extra = object> = Record<
	string,
	Extra & { data: Record<string, Row | undefined> }
>;

/** Prefixes of local authority district codes, by nation. */
const DISTRICT_PREFIXES: Readonly<Record<string, readonly string[]>> = {
	"GB-ENG": ["E06", "E07", "E08", "E09"],
	"GB-WLS": ["W06"],
	"GB-SCT": ["S12"],
	"GB-NIR": ["N09"],
};

/** Places the income tables publish a figure for, by their code there. */
const INCOME_AREA_CODES: Readonly<Record<string, string>> = {
	England: "E92000001",
	"North East": "E12000001",
	"North West": "E12000002",
	Yorkshire: "E12000003",
	"East Midlands": "E12000004",
	"West Midlands": "E12000005",
	"East of England": "E12000006",
	London: "E12000007",
	"South East": "E12000008",
	"South West": "E12000009",
};

/**
 * The local authorities a place covers in one dataset: its members, or for a
 * nation or the UK, every district the dataset has there.
 */
function districtsOf(
	location: AtlasLocation,
	codes: Iterable<string>,
): readonly string[] {
	if (location.members.length > 0) return location.members;
	const prefixes = location.countries.flatMap(
		(country) => DISTRICT_PREFIXES[country] ?? [],
	);
	return [...new Set(codes)].filter((code) =>
		prefixes.some((prefix) => code.startsWith(prefix)),
	);
}

/** Each district's value, or null when any district has none. */
function everyValue<T>(
	districts: readonly string[],
	read: (code: string) => T | null | undefined,
): T[] | null {
	if (districts.length === 0) return null;
	const values: T[] = [];
	for (const code of districts) {
		const value = read(code);
		if (value === null || value === undefined) return null;
		values.push(value);
	}
	return values;
}

function rangeOf(values: readonly Extreme[]): MapFigure | null {
	if (values.length < 2) return null;
	let low = values[0];
	let high = values[0];
	for (const value of values) {
		if (value.value < low.value) low = value;
		if (value.value > high.value) high = value;
	}
	return { kind: "range", low, high };
}

const sum = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0);

function populationOf(
	dataset: PopulationUkDataset,
	districts: readonly string[],
): number | null {
	const totals = everyValue(districts, (code) => {
		const record = dataset.data[code];
		return record ? sum(Object.values(record.total)) : null;
	});
	return totals && sum(totals);
}

/** The latest edition at or before a year, by the editions' own keys. */
function editionFor<T>(editions: Record<string, T>, year: number): T {
	const keys = Object.keys(editions)
		.map(Number)
		.filter((key) => key <= year)
		.sort((a, b) => b - a);
	return editions[String(keys[0])];
}

type FigureRule = {
	compute(
		inputs: FigureInputs,
		location: AtlasLocation,
		period: number,
	): MapFigure | null;
	sentence(figure: MapFigure, place: string, period: number): string | null;
};

const RULES: Readonly<Record<string, FigureRule>> = {
	"population-density": {
		compute({ populationUk, landArea }, location, period) {
			const population = editionFor(populationUk, period);
			const land = editionFor(landArea, Infinity);
			const districts = districtsOf(
				location,
				Object.keys(population.data),
			);
			const people = populationOf(population, districts);
			const areas = everyValue(
				districts,
				(code) => land.data[code]?.landSquareKm,
			);
			if (people === null || areas === null) return null;
			return { kind: "density", population: people, areaKm2: sum(areas) };
		},
		sentence(figure, place) {
			if (figure.kind !== "density") return null;
			return `${place} has ${people(figure.population)} people, about ${rounded(figure.population / figure.areaKm2)} per km².`;
		},
	},
	"house-price": {
		compute({ housePrice }, location, period) {
			const dataset = housePrice[String(period)];
			const wards = Object.values(dataset.data);
			const districts = districtsOf(
				location,
				wards.map((ward) => ward.ladCode),
			);
			const prices: Extreme[] = [];
			for (const code of districts) {
				const priced = wards.filter(
					(ward) =>
						ward.ladCode === code &&
						ward.prices[period] !== undefined,
				);
				if (priced.length === 0) return null;
				// Ward names repeat across the country, so a place of several
				// authorities names the authority too.
				for (const ward of priced)
					prices.push({
						name:
							districts.length > 1
								? `${ward.wardName}, ${ward.ladName}`
								: ward.wardName,
						value: ward.prices[period],
					});
			}
			return rangeOf(prices);
		},
		sentence(figure, place, period) {
			if (figure.kind !== "range") return null;
			return `Median house prices in ${place} range from ${pounds(figure.low.value)} in ${figure.low.name} to ${pounds(figure.high.value)} in ${figure.high.name} (${period}).`;
		},
	},
	crime: {
		compute({ crime, populationUk }, location, period) {
			const dataset = crime[String(period)];
			const population = editionFor(populationUk, period);
			const districts = districtsOf(location, Object.keys(dataset.data));
			// A zero total means the table did not attribute the authority.
			const crimes = everyValue(
				districts,
				(code) => dataset.data[code]?.totalRecordedCrime || null,
			);
			const people = populationOf(population, districts);
			if (crimes === null || people === null) return null;
			return {
				kind: "crime",
				crimes: sum(crimes),
				population: people,
				period: dataset.dataDate,
			};
		},
		sentence(figure, place) {
			if (figure.kind !== "crime") return null;
			return `${place} had ${whole(figure.crimes)} police recorded crimes in the ${figure.period}, about ${whole((figure.crimes / figure.population) * 1000)} per 1,000 residents.`;
		},
	},
	"life-expectancy": {
		compute({ lifeExpectancy }, location) {
			const dataset = lifeExpectancy.le;
			const districts = districtsOf(location, Object.keys(dataset.data));
			const records = everyValue(districts, (code) => dataset.data[code]);
			if (records === null) return null;
			if (records.length === 1)
				return {
					kind: "sexes",
					male: records[0].maleBirthLE,
					female: records[0].femaleBirthLE,
				};
			return rangeOf(
				records.map((record) => ({
					name: record.ladName,
					value: (record.maleBirthLE + record.femaleBirthLE) / 2,
				})),
			);
		},
		sentence(figure, place) {
			if (figure.kind === "sexes")
				return `Life expectancy at birth in ${place} is ${years(figure.male)} years for men and ${years(figure.female)} for women (2022 to 2024).`;
			if (figure.kind === "range")
				return `Life expectancy at birth in ${place} ranges from ${years(figure.low.value)} years in ${figure.low.name} to ${years(figure.high.value)} in ${figure.high.name}, averaging men and women (2022 to 2024).`;
			return null;
		},
	},
	income: {
		compute({ income }, location, period) {
			const dataset = income[String(period)];
			const published = INCOME_AREA_CODES[location.name];
			const exact = published && dataset.data[published]?.annual?.median;
			if (exact) return { kind: "value", value: exact };
			const districts = districtsOf(location, Object.keys(dataset.data));
			const medians = everyValue(districts, (code) => {
				const record = dataset.data[code];
				const median = record?.annual?.median;
				return median ? { name: record.ladName, value: median } : null;
			});
			if (medians === null) return null;
			if (medians.length === 1)
				return { kind: "value", value: medians[0].value };
			return rangeOf(medians);
		},
		sentence(figure, place, period) {
			if (figure.kind === "value")
				return `Median annual pay for employees living in ${place} is ${pounds(figure.value)} (${period}).`;
			if (figure.kind === "range")
				return `Median annual pay for employees in ${place} ranges from ${pounds(figure.low.value)} in ${figure.low.name} to ${pounds(figure.high.value)} in ${figure.high.name} (${period}).`;
			return null;
		},
	},
	"child-poverty": {
		compute({ childPoverty }, location, period) {
			const { data } = childPoverty[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			const children = sum(rows.map((row) => row.childrenPopulation));
			const poor = sum(rows.map((row) => row.childCount));
			return { kind: "percent", percent: (poor / children) * 100 };
		},
		sentence(figure, place, period) {
			if (figure.kind !== "percent") return null;
			return `${percent(figure.percent)} of children in ${place} live in relative low-income families, before housing costs (${period}).`;
		},
	},
	broadband: {
		compute({ broadband }, location, period) {
			const { data } = broadband[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			return {
				kind: "percent",
				percent: premisesWeighted(
					rows.map((row) => [row.pctFullFibre, row.premisesCount]),
				),
			};
		},
		sentence(figure, place, period) {
			if (figure.kind !== "percent") return null;
			return `${percent(figure.percent)} of premises in ${place} can get full fibre broadband (${period}).`;
		},
	},
	"mobile-coverage": {
		compute({ mobileCoverage }, location, period) {
			const { data } = mobileCoverage[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			return {
				kind: "percent",
				percent: premisesWeighted(
					rows.map((row) => [row.pct5GOutdoorAll, row.premisesCount]),
				),
			};
		},
		sentence(figure, place, period) {
			if (figure.kind !== "percent") return null;
			return `${percent(figure.percent)} of premises in ${place} have outdoor 5G from all four mobile operators (${period}).`;
		},
	},
	"business-activity": {
		compute({ businessActivity }, location, period) {
			const { data } = businessActivity[String(period)];
			const counts = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code]?.value,
			);
			return counts && { kind: "count", count: sum(counts) };
		},
		sentence(figure, place, period) {
			if (figure.kind !== "count") return null;
			return `${place} has ${rounded(figure.count)} VAT or PAYE registered businesses (${period}).`;
		},
	},
	"electric-vehicle-chargers": {
		compute({ electricVehicleChargers, populationUk }, location, period) {
			const { data } = electricVehicleChargers[String(period)];
			const districts = districtsOf(location, Object.keys(data));
			const counts = everyValue(districts, (code) => data[code]?.value);
			const residents = populationOf(
				editionFor(populationUk, period),
				districts,
			);
			if (counts === null || residents === null) return null;
			const count = sum(counts);
			return {
				kind: "count",
				count,
				rate: (count / residents) * 100_000,
			};
		},
		sentence(figure, place, period) {
			if (figure.kind !== "count" || figure.rate === undefined)
				return null;
			return `${place} has ${whole(figure.count)} public electric vehicle chargers, about ${whole(figure.rate)} per 100,000 residents (${period}).`;
		},
	},
	"council-tax": {
		compute({ councilTax }, location, period) {
			const { data } = councilTax[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			// Averaging councils' Band D would need their dwelling counts.
			if (rows.length === 1)
				return { kind: "value", value: rows[0].value };
			return rangeOf(
				rows.map((row) => ({ name: row.name, value: row.value })),
			);
		},
		sentence(figure, place, period) {
			const year = `${period}-${String(period + 1).slice(2)}`;
			if (figure.kind === "value")
				return `Average Band D council tax in ${place} is ${pounds(figure.value)} for ${year}.`;
			if (figure.kind === "range")
				return `Average Band D council tax in ${place} ranges from ${pounds(figure.low.value)} in ${figure.low.name} to ${pounds(figure.high.value)} in ${figure.high.name} for ${year}.`;
			return null;
		},
	},
	"claimant-count": {
		compute({ claimantCount }, location, period) {
			const { data, month } = claimantCount[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			// The published rate is rounded, so a place of several authorities
			// gets the exact total rather than a rate rebuilt from it.
			if (rows.length === 1)
				return {
					kind: "count",
					count: rows[0].totalCount,
					rate: rows[0].totalRate,
					period: month,
				};
			return {
				kind: "count",
				count: sum(rows.map((row) => row.totalCount)),
				period: month,
			};
		},
		sentence(figure, place) {
			if (figure.kind !== "count") return null;
			if (figure.rate !== undefined)
				return `${place} had ${whole(figure.count)} people claiming out-of-work benefits in ${figure.period}, ${figure.rate.toFixed(1)}% of residents aged 16 to 64.`;
			return `${place} had ${whole(figure.count)} people claiming out-of-work benefits in ${figure.period}.`;
		},
	},
	homelessness: {
		compute({ homelessness }, location, period) {
			const { data, quarter } = homelessness[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			const count = sum(
				rows.map((row) => row.householdsInTemporaryAccommodation),
			);
			// Each authority's households, from its count and its exact rate.
			const households = rows.every(
				(row) => row.householdsPerThousand > 0,
			)
				? sum(
						rows.map(
							(row) =>
								(row.householdsInTemporaryAccommodation /
									row.householdsPerThousand) *
								1000,
						),
					)
				: null;
			return {
				kind: "count",
				count,
				...(households ? { rate: (count / households) * 1000 } : {}),
				period: quarter,
			};
		},
		sentence(figure, place) {
			if (figure.kind !== "count") return null;
			const rate =
				figure.rate === undefined
					? ""
					: `, ${figure.rate.toFixed(1)} per 1,000 households`;
			return `${place} had ${whole(figure.count)} households in temporary accommodation in ${figure.period}${rate}.`;
		},
	},
	"ghg-emissions": {
		compute({ ghgEmissions }, location, period) {
			const { data } = ghgEmissions[String(period)];
			const rows = everyValue(
				districtsOf(location, Object.keys(data)),
				(code) => data[code],
			);
			if (rows === null) return null;
			const kilotonnes = sum(rows.map((row) => row.totalKtCO2e));
			const thousands = sum(rows.map((row) => row.populationThousands));
			// Kilotonnes per thousand people is tonnes per person.
			return {
				kind: "count",
				count: kilotonnes * 1000,
				rate: kilotonnes / thousands,
			};
		},
		sentence(figure, place, period) {
			if (figure.kind !== "count" || figure.rate === undefined)
				return null;
			return `${place} emitted ${tonnes(figure.count)} of greenhouse gases in ${period}, ${figure.rate.toFixed(1)} tonnes per person.`;
		},
	},
};

/** A share of premises across areas, weighted by each area's premises. */
function premisesWeighted(rows: readonly (readonly [number, number])[]) {
	const premises = sum(rows.map(([, count]) => count));
	return sum(rows.map(([share, count]) => share * count)) / premises;
}

const percent = (value: number) => `${value.toFixed(1)}%`;

/** "25.1 million tonnes", "588,000 tonnes" of CO2 equivalent. */
function tonnes(value: number) {
	if (value >= 1e6) return `${(value / 1e6).toFixed(1)} million tonnes CO2e`;
	return `${rounded(value)} tonnes CO2e`;
}

const whole = (value: number) => Math.round(value).toLocaleString("en-GB");

/** To three significant figures: "5,640", "552,000". */
const rounded = (value: number) =>
	Number(value.toPrecision(3)).toLocaleString("en-GB");

/** "8.9 million", "552,000". */
function people(value: number) {
	if (value >= 1e6) return `${(value / 1e6).toFixed(1)} million`;
	return rounded(value);
}

/** "£295,000", "£3.2 million". */
function pounds(value: number) {
	if (value >= 1e6) return `£${(value / 1e6).toFixed(1)} million`;
	return `£${whole(value)}`;
}

const years = (value: number) => value.toFixed(1);

/** Every figure the data supports, for the committed figures file. */
export function compileMapFigures(inputs: FigureInputs): MapFigures {
	const figures: MapFigures = {};
	for (const [slug, rule] of Object.entries(RULES)) {
		const map = findAtlasMap(slug);
		if (!map) throw new Error(`No atlas map "${slug}" to describe.`);
		const byLocation: Record<string, MapFigure> = {};
		for (const location of ATLAS_LOCATIONS) {
			// A figure for a place counts all of it, so the data must reach
			// every nation the place spans, not just enough for the map.
			if (
				!atlasMapCovers(map, location) ||
				!location.countries.every((country) =>
					map.countries.includes(country),
				)
			)
				continue;
			const figure = rule.compute(inputs, location, map.periods[0]);
			if (figure) byLocation[location.slug] = figure;
		}
		figures[slug] = byLocation;
	}
	return figures;
}

/** The sentence a page's snippet leads with, or null without a figure. */
export function mapFigureSentence(
	figures: MapFigures,
	location: AtlasLocation,
	mapSlug: string,
): string | null {
	const rule = RULES[mapSlug];
	const map = findAtlasMap(mapSlug);
	const figure = figures[mapSlug]?.[location.slug];
	if (!rule || !map || !figure) return null;
	const sentence = rule.sentence(
		figure,
		locationLabel(location),
		map.periods[0],
	);
	return sentence && sentence[0].toUpperCase() + sentence.slice(1);
}
