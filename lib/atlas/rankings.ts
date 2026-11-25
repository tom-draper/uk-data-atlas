import { CHART_DATASET_DEFINITIONS, datasetSlug } from "@/lib/datasets";
import type { ChartDatasetDefinition } from "@/lib/datasets";
import { declaredRanking, formatDisplay } from "@/lib/datasets/declared";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { gazetteer } from "@/lib/data/gazetteer/static";
import localAuthorityCounty from "@/lib/data/boundaries/localAuthorityCounty.json";
import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	type AtlasLocation,
	type AtlasMap,
	atlasMapTitle,
	atlasVizFor,
	findAtlasMap,
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
 * are compiled from the committed datasets by `scripts/build-seo-data.mts`
 * in `pnpm build`, one file per map, and a page reads the areas within its
 * place.
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
	/** The period ranked, where it is not the map's latest. */
	period?: number;
	level: RankingLevel;
	columns?: RankedColumn[];
	areas: RankedArea[];
};

const RANKED_LEVELS = new Set<string>([
	"localAuthority",
	"countyAndUnitaryAuthority",
	"ward",
	"division",
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
	countyAndUnitaryAuthority: { one: "council", many: "councils" },
	ward: { one: "ward", many: "wards" },
	division: { one: "division", many: "divisions" },
	constituency: { one: "constituency", many: "constituencies" },
	itl3: { one: "area", many: "areas" },
	icb: { one: "integrated care board", many: "integrated care boards" },
};

/** What a ranking's rows are, such as "ward" or "local authority". */
export const rankedAreaNoun = (map: AtlasMap) =>
	LEVEL_NOUNS[rankingSource(map)?.level ?? "localAuthority"].one;

/**
 * The rankings a map's data holds besides its own, such as county council
 * divisions in the local election results: the map under the recipe's slug.
 */
const DERIVED_MAPS: ReadonlyMap<string, AtlasMap> = new Map(
	Object.entries(RANKING_RECIPES).flatMap(([slug, recipe]) => {
		const of = recipe.of ? findAtlasMap(recipe.of) : undefined;
		return of
			? [[slug, { ...of, slug, name: recipe.title ?? of.name }]]
			: [];
	}),
);

/** A ranked map by its slug, an atlas map's or one a recipe derives. */
const findRankedMap = (slug: string) =>
	findAtlasMap(slug) ?? DERIVED_MAPS.get(slug);

export const RANKED_MAPS: readonly AtlasMap[] = [
	...ATLAS_MAPS,
	...DERIVED_MAPS.values(),
].filter((map) => rankingSource(map) !== null);

/** The periods of a map that are ranked, latest first. */
export function rankedPeriods(map: AtlasMap): readonly number[] {
	return RANKING_RECIPES[map.slug]?.earlierPeriods
		? map.periods
		: map.periods.slice(0, 1);
}

const isLatest = (map: AtlasMap, period?: number) =>
	period === undefined || period === map.periods[0];

/**
 * A ranking's key, its page's slug and file's name: the map's slug, with the
 * year for an earlier period, "general-election-2019".
 */
export const rankingKey = (map: AtlasMap, period?: number) =>
	isLatest(map, period) ? map.slug : `${map.slug}-${period}`;

/** The map and period a ranking key names. */
export function findRanking(
	key: string,
): { map: AtlasMap; period: number } | null {
	const latest = findRankedMap(key);
	if (latest) return { map: latest, period: latest.periods[0]! };
	const [, slug, year] = /^(.+)-(\d{4})$/.exec(key) ?? [];
	const map = slug ? findRankedMap(slug) : undefined;
	const period = Number(year);
	return map && rankedPeriods(map).includes(period) && !isLatest(map, period)
		? { map, period }
		: null;
}

/** Each county's districts; a unitary council is its own. */
const COUNTY_DISTRICTS = Object.entries(
	localAuthorityCounty as Record<string, string>,
).reduce((counties, [district, county]) => {
	counties.set(county, [...(counties.get(county) ?? []), district].sort());
	return counties;
}, new Map<string, string[]>());

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
	period?: number,
): MapRanking | null {
	const source = rankingSource(map);
	if (!source) return null;
	const { definition, recipe, level } = source;
	const viz = atlasVizFor(map, period);
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
		editions: datedEditions(editions),
		inputs,
		valueIn,
	};

	const rows: RankingRow[] = recipe.rows
		? recipe.rows(context)
		: Object.entries(edition.data).flatMap(([code, record]) => {
				const value = valueIn(edition, code);
				if (value === null) return [];
				const districts =
					level === "countyAndUnitaryAuthority"
						? COUNTY_DISTRICTS.get(code)
						: undefined;
				const district =
					level === "ward"
						? String(record.ladCode ?? "")
						: (districts?.[0] ?? successorCouncil(code) ?? code);
				if (!district) return [];
				return [
					{
						code,
						name: areaName(level, code, record),
						district,
						value,
						record,
						...(districts && districts.length > 1
							? { within: districts }
							: {}),
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
		...(isLatest(map, period) ? {} : { period: viz.datasetYear }),
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
 * whole place, and the place has more than one area to rank. An earlier
 * period is ranked only for the UK and its nations.
 */
export function hasRankingPage(
	ranking: MapRanking,
	map: AtlasMap,
	location: AtlasLocation,
) {
	return (
		(ranking.period === undefined || location.members.length === 0) &&
		location.countries.every((country) =>
			map.countries.includes(country),
		) &&
		areasWithin(ranking, location).length > 1
	);
}

/** A ranking page's title for its map: "2024 General Election Results". */
export const rankingTitle = (map: AtlasMap, period?: number) =>
	(isLatest(map, period) && RANKING_RECIPES[map.slug]?.title) ||
	atlasMapTitle(map, period);

/** What a ranking's value column measures, where the map's name is unclear. */
export const rankedValueLabel = (map: AtlasMap) =>
	declaredRanking(map.dataset, map.view)?.label ??
	RANKING_RECIPES[map.slug]?.label ??
	map.name;

/**
 * How a ranked value reads: as its dataset declares, its recipe, the map's
 * card, or else its legend.
 */
export function formatRankedValue(map: AtlasMap, value: number) {
	const format =
		declaredRanking(map.dataset, map.view)?.format ??
		RANKING_RECIPES[map.slug]?.format;
	if (format) return formatDisplay(format, value);
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
	// A rate such as "per 1,000 residents" keeps a decimal while it is small.
	count: (value) => {
		const digits =
			Math.abs(value) < 100 && !Number.isInteger(value) ? 1 : 0;
		return value.toLocaleString("en-GB", {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		});
	},
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
