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
	| { kind: "range"; low: Extreme; high: Extreme };

/** Figures by map slug, then location slug. */
export type MapFigures = Record<string, Record<string, MapFigure>>;

export type FigureInputs = {
	populationUk: Record<string, PopulationUkDataset>;
	landArea: Record<string, LandAreaDataset>;
	housePrice: Record<string, HousePriceDataset>;
	crime: Record<string, CrimeDataset>;
	lifeExpectancy: Record<string, LifeExpectancyDataset>;
	income: Record<string, IncomeDataset>;
};

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
				return `Median annual pay for employees ranges from ${pounds(figure.low.value)} in ${figure.low.name} to ${pounds(figure.high.value)} in ${figure.high.name} (${period}).`;
			return null;
		},
	},
};

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
