import { CHART_DATASET_DEFINITIONS, datasetSlug } from "@/lib/datasets";
import type { ChartDatasetDefinition } from "@/lib/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { gazetteer } from "@/lib/data/gazetteer/static";
import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	type AtlasLocation,
	type AtlasMap,
	atlasVizFor,
} from "@/lib/atlas/pages";
import {
	councilName,
	RANKING_RECIPES,
	successorCouncil,
	type ColumnFormat,
	type DataRecord,
	type DatedEdition,
	type Edition,
	type Editions,
	type RankingContext,
	type RankingLevel,
	type RankingRecipe,
	type RankingRow,
} from "@/lib/atlas/rankingRecipes";

/**
 * Every area of a map ranked, for the `/maps/{place}/{map}` pages. Rankings
 * are compiled from the committed datasets by `pnpm data:build --only seo`, one file per
 * map, and a page reads the areas within its place.
 *
 * A map is ranked when its areas are local authorities, or wards that name
 * themselves, and one number orders them: the map's colour, or a value its
 * recipe in `rankingRecipes.ts` gives it. A recipe can also roll smaller
 * areas up into councils and add columns of context.
 */

export type RankedArea = {
	code: string;
	name: string;
	/** The local authority a ward sits in; the authority itself otherwise. */
	district: string;
	value: number;
	/**
	 * The councils an area covers, where it is more than its district: a
	 * place's page lists it when most of them are the place's.
	 */
	within?: string[];
	/** The extra columns' values, in the order of `MapRanking.columns`. */
	extra?: (number | string | null)[];
};

export type RankedColumn = { label: string; format: ColumnFormat };

export type MapRanking = {
	map: string;
	level: RankingLevel;
	columns?: RankedColumn[];
	areas: RankedArea[];
};

const RANKED_LEVELS = new Set<string>([
	"localAuthority",
	"ward",
	"constituency",
	"itl3",
	"icb",
]);

function definitionOf(map: AtlasMap) {
	return CHART_DATASET_DEFINITIONS.find(
		(definition) => datasetSlug(definition.type) === map.dataset,
	) as ChartDatasetDefinition<{ type: string; data: unknown }> | undefined;
}

/** Whether a map can be ranked, and from which compiled files. */
export function rankingSource(map: AtlasMap) {
	const definition = definitionOf(map);
	if (!definition) return null;
	const recipe: RankingRecipe = RANKING_RECIPES[map.slug] ?? {};
	const level = recipe.level ?? definition.boundaryType;
	if (!RANKED_LEVELS.has(level)) return null;
	const valued =
		recipe.rows ??
		recipe.value ??
		definition.map?.valueFor ??
		definition.map?.valueKey;
	if (!valued) return null;
	// Areas other than councils are ranked only where a recipe reads their
	// names and the councils they sit in.
	if (level !== "localAuthority" && !RANKING_RECIPES[map.slug]) return null;
	return {
		file: definition.precompiledFile,
		inputs: recipe.inputs ?? [],
		definition,
		recipe,
		level: level as RankingLevel,
	};
}

/** What each level's rows are called, one and many. */
export const LEVEL_NOUNS: Readonly<
	Record<RankingLevel, { one: string; many: string }>
> = {
	localAuthority: { one: "local authority", many: "local authorities" },
	ward: { one: "ward", many: "wards" },
	constituency: { one: "constituency", many: "constituencies" },
	itl3: { one: "area", many: "areas" },
	icb: { one: "integrated care board", many: "integrated care boards" },
};

/** What a ranking's rows are, such as "ward" or "local authority". */
export const rankedAreaNoun = (map: AtlasMap) =>
	LEVEL_NOUNS[rankingSource(map)?.level ?? "localAuthority"].one;

export const RANKED_MAPS: readonly AtlasMap[] = ATLAS_MAPS.filter(
	(map) => rankingSource(map) !== null,
);

const editionYear = (key: string, edition: Edition) =>
	edition.year ?? (/^\d{4}$/.test(key) ? Number(key) : null);

/** The file's editions in year order, those without a year left out. */
function datedEditions(editions: Editions): DatedEdition[] {
	return Object.entries(editions)
		.flatMap(([key, edition]) => {
			const year = editionYear(key, edition);
			return year === null ? [] : [{ ...edition, year }];
		})
		.sort((a, b) => a.year - b.year);
}

/** A map's areas from its compiled editions, highest value first. */
export function compileRanking(
	map: AtlasMap,
	editions: Editions,
	inputs: Readonly<Record<string, unknown>> = {},
): MapRanking | null {
	const source = rankingSource(map);
	if (!source) return null;
	const { definition, recipe, level } = source;
	const viz = atlasVizFor(map);
	const key =
		Object.keys(editions).find(
			(candidate) => editions[candidate]!.id === viz.datasetId,
		) ?? String(viz.datasetYear);
	const current = editions[key];
	if (!current) return null;
	const year = editionYear(key, current) ?? viz.datasetYear;
	const edition = { ...current, year };
	const earlier = datedEditions(editions).filter(
		(candidate) => candidate.year < year,
	);

	const valueIn = (from: Edition, code: string) => {
		const record = from.data[code];
		if (!record) return null;
		const value = recipe.value
			? recipe.value(record, code, from)
			: definition.map?.valueFor
				? definition.map.valueFor(
						{ ...from, type: definition.type } as never,
						code,
						DEFAULT_MAP_OPTIONS,
					)
				: record[definition.map?.valueKey ?? ""];
		return typeof value === "number" && Number.isFinite(value)
			? value
			: null;
	};

	const context: RankingContext = {
		year,
		edition,
		previous: earlier.at(-1),
		first: earlier[0],
		inputs,
		valueIn,
	};

	const rows: RankingRow[] = recipe.rows
		? recipe.rows(context)
		: Object.entries(edition.data).flatMap(([code, record]) => {
				const value = valueIn(edition, code);
				if (value === null) return [];
				const district =
					level === "ward"
						? String(record.ladCode ?? "")
						: (successorCouncil(code) ?? code);
				if (!district) return [];
				return [
					{
						code,
						name: areaName(level, code, record),
						district,
						value,
						record,
					},
				];
			});

	const columns = (recipe.columns ?? []).flatMap((column) => {
		const label =
			typeof column.label === "string"
				? column.label
				: column.label(context);
		return label === null ? [] : [{ column, label }];
	});

	// A file can hold a merged council and the councils it replaced; the
	// council's own figure stands for it, and theirs would count it twice.
	const ownFigures = new Set(
		rows.filter((row) => row.code === row.district).map((row) => row.code),
	);
	const areas: RankedArea[] = rows
		.filter(
			(row) =>
				Number.isFinite(row.value) &&
				(level !== "localAuthority" ||
					row.code === row.district ||
					!ownFigures.has(row.district)),
		)
		.map((row) => {
			const area: RankedArea = {
				code: row.code,
				name: row.name,
				district: row.district,
				value: row.value,
			};
			if (row.within && row.within.length > 0) area.within = row.within;
			if (columns.length > 0)
				area.extra = columns.map(({ column }) => {
					const value = column.value(row, context);
					return typeof value === "string" ||
						(value !== null && Number.isFinite(value))
						? value
						: null;
				});
			return area;
		})
		.sort((a, b) => b.value - a.value);

	return {
		map: map.slug,
		level,
		...(columns.length > 0
			? {
					columns: columns.map(({ column, label }) => ({
						label,
						format: column.format,
					})),
				}
			: {}),
		areas,
	};
}

function areaName(level: RankingLevel, code: string, record: DataRecord) {
	if (level === "ward") return String(record.wardName ?? code);
	return councilName(
		gazetteer.get(code)?.name ??
			String(record.ladName ?? record.name ?? code),
	);
}

const DISTRICT_PREFIXES: Readonly<Record<string, readonly string[]>> = {
	"GB-ENG": ["E06", "E07", "E08", "E09"],
	"GB-WLS": ["W06"],
	"GB-SCT": ["S12"],
	// Northern Ireland voted as one area in the EU referendum.
	"GB-NIR": ["N09", "N92"],
};

/**
 * The areas of a ranking within a place, in rank order: those whose district,
 * or most of the councils they cover, are the place's.
 */
export function areasWithin(
	ranking: MapRanking,
	location: AtlasLocation,
): RankedArea[] {
	const prefixes = location.countries.flatMap(
		(country) => DISTRICT_PREFIXES[country] ?? [],
	);
	const members = new Set(location.members);
	const inPlace =
		location.members.length > 0
			? (code: string) => members.has(code)
			: (code: string) =>
					prefixes.some((prefix) => code.startsWith(prefix));
	return ranking.areas.filter((area) => {
		const councils = area.within ?? [area.district];
		return councils.filter(inPlace).length * 2 > councils.length;
	});
}

/**
 * Whether a place has a ranking page for a map: the map's data reaches the
 * whole place, and the place has more than one area to rank.
 */
export function hasRankingPage(
	ranking: MapRanking,
	map: AtlasMap,
	location: AtlasLocation,
) {
	return (
		location.countries.every((country) =>
			map.countries.includes(country),
		) && areasWithin(ranking, location).length > 1
	);
}

const pounds = (value: number) =>
	`£${Math.round(value).toLocaleString("en-GB")}`;

/** Maps whose card or legend format is too coarse for a table. */
const RANKED_FORMATS: Readonly<Record<string, (value: number) => string>> = {
	"house-price": pounds,
	income: pounds,
	"council-tax": (value) =>
		`£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
	// Published in thousands of pounds.
	"local-government-finance": (value) => pounds(value * 1000),
	"ghg-emissions": (value) => `${value.toFixed(1)} tonnes`,
	qualification: (value) => `${value.toFixed(1)}%`,
	"car-availability": (value) => `${value.toFixed(1)}%`,
	"child-poverty": (value) => `${value.toFixed(1)}%`,
	"travel-to-work": (value) => `${value.toFixed(1)}%`,
	brexit: (value) => `${value.toFixed(1)}%`,
	ethnicity: (value) => `${value.toFixed(1)}%`,
	"fuel-poverty": (value) => `${value.toFixed(1)}%`,
	imd: (value) => `${value.toFixed(1)}%`,
	nimdm: (value) => `${value.toFixed(1)}%`,
	simd: (value) => `${value.toFixed(1)}%`,
	wimd: (value) => `${value.toFixed(1)}%`,
	"population-age": (value) => `${value.toFixed(1)} years`,
	"general-election": (value) => `${value.toFixed(1)}%`,
	"brexit-constituency": (value) => `${value.toFixed(1)}%`,
	"nhs-waiting": (value) => `${value.toFixed(1)}%`,
	// Published in millions of pounds.
	"regional-gdp-itl3": (value) =>
		`£${Math.round(value).toLocaleString("en-GB")}m`,
	"population-density": (value) =>
		`${Math.round(value).toLocaleString("en-GB")} per km²`,
};

/** What a ranking's value column measures, where the map's name is unclear. */
const RANKED_VALUE_LABELS: Readonly<Record<string, string>> = {
	"car-availability": "Households without a car",
	qualification: "Residents with degree-level qualifications",
	"local-government-finance": "Education services spending",
	crime: "Police recorded crimes",
	"ghg-emissions": "Emissions per person (CO2e)",
	"house-price": "Median price paid",
	income: "Median annual pay",
	"council-tax": "Average Band D council tax",
	"child-poverty": "Children in low-income families",
	"claimant-count": "Claimants, % of residents aged 16 to 64",
	broadband: "Premises with full fibre",
	"mobile-coverage": "Premises with outdoor 5G from all operators",
	"electric-vehicle-chargers": "Public chargers",
	"business-activity": "VAT or PAYE businesses",
	homelessness: "Households in temporary accommodation per 1,000",
	brexit: "Share voting Leave",
	ethnicity: "White British residents",
	"fuel-poverty": "Households in fuel poverty",
	imd: "Neighbourhoods in England's most deprived 10%",
	nimdm: "Neighbourhoods in Northern Ireland's most deprived 10%",
	simd: "Data zones in Scotland's most deprived 10%",
	wimd: "Neighbourhoods in Wales' most deprived 10%",
	"population-age": "Median age",
	"general-election": "Majority as a share of votes",
	"brexit-constituency": "Estimated share voting Leave",
	"nhs-waiting": "Patients waiting over 18 weeks",
	"regional-gdp-itl3": "Gross domestic product",
	"population-density": "Residents per km²",
};

export const rankedValueLabel = (map: AtlasMap) =>
	RANKED_VALUE_LABELS[map.slug] ?? map.name;

/** How a ranked value reads: as the map's card shows it, or its legend. */
export function formatRankedValue(map: AtlasMap, value: number) {
	const format = RANKED_FORMATS[map.slug];
	if (format) return format(value);
	const definition = rankingSource(map)?.definition;
	const card = definition?.chart.card;
	if (card?.format)
		return `${card.format(value)}${card.unit ? ` ${card.unit}` : ""}`;
	return (
		definition?.map?.legend.format(value, DEFAULT_MAP_OPTIONS) ??
		String(value)
	);
}

const signed = (value: number, digits: number, unit: string) => {
	const rounded = Number(value.toFixed(digits));
	const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
	return `${sign}${Math.abs(rounded).toFixed(digits)}${unit}`;
};

const COLUMN_FORMATS: Readonly<
	Record<ColumnFormat, (value: number) => string>
> = {
	percent: (value) => `${value.toFixed(1)}%`,
	signedPercent: (value) => signed(value, 1, "%"),
	signedPoints: (value) => signed(value, 1, " pts"),
	count: (value) => Math.round(value).toLocaleString("en-GB"),
	years: (value) => value.toFixed(1),
	micrograms: (value) => `${value.toFixed(1)} µg/m³`,
	text: String,
	squareKm: (value) =>
		`${value.toLocaleString("en-GB", { maximumFractionDigits: value < 10 ? 2 : 1 })} km²`,
};

/** How an extra column's value reads; a dash where the data has none. */
export const formatColumnValue = (
	column: RankedColumn,
	value: number | string | null | undefined,
) =>
	value === null || value === undefined
		? "–"
		: typeof value === "string"
			? value
			: COLUMN_FORMATS[column.format](value);

/** The place pages a council's row links to, by council code. */
export const COUNCIL_PLACES: ReadonlyMap<string, AtlasLocation> = new Map(
	ATLAS_LOCATIONS.filter((location) => location.members.length === 1).map(
		(location) => [location.members[0], location],
	),
);
