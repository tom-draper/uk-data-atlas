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

/**
 * Every area of a map ranked, for the `/maps/{place}/{map}` pages. Rankings
 * are compiled from the committed datasets by `pnpm seo:build`, one file per
 * map, and a page reads the areas within its place.
 *
 * A map is ranked when its areas are local authorities, or wards that name
 * themselves, and it colours them by one number.
 */

export type RankedArea = {
	code: string;
	name: string;
	/** The local authority a ward sits in; the authority itself otherwise. */
	district: string;
	value: number;
};

export type MapRanking = {
	map: string;
	level: "localAuthority" | "ward";
	areas: RankedArea[];
};

type Edition = {
	id?: string;
	data: Record<string, Record<string, unknown>>;
};

const RANKED_LEVELS = new Set(["localAuthority", "ward"]);

function definitionOf(map: AtlasMap) {
	return CHART_DATASET_DEFINITIONS.find(
		(definition) => datasetSlug(definition.type) === map.dataset,
	) as ChartDatasetDefinition<{ type: string; data: unknown }> | undefined;
}

/** Whether a map can be ranked, and from which compiled file. */
export function rankingSource(map: AtlasMap) {
	const definition = definitionOf(map);
	if (!definition?.map || !RANKED_LEVELS.has(definition.boundaryType))
		return null;
	if (!definition.map.valueKey && !definition.map.valueFor) return null;
	// Wards are ranked only where the records carry the ward's name.
	if (definition.boundaryType === "ward" && map.dataset !== "house-price")
		return null;
	return { file: definition.precompiledFile, definition };
}

export const RANKED_MAPS: readonly AtlasMap[] = ATLAS_MAPS.filter(
	(map) => rankingSource(map) !== null,
);

/** "Bristol, City of" reads as "Bristol", as the council's place does. */
const councilName = (name: string) => name.replace(/, (City|County) of$/, "");

/** A map's areas from its compiled editions, highest value first. */
export function compileRanking(
	map: AtlasMap,
	editions: Record<string, Edition>,
): MapRanking | null {
	const source = rankingSource(map);
	if (!source) return null;
	const { definition } = source;
	const viz = atlasVizFor(map);
	const edition =
		Object.values(editions).find(
			(candidate) => candidate.id === viz.datasetId,
		) ?? editions[String(viz.datasetYear)];
	if (!edition) return null;
	const dataset = { ...edition, type: definition.type };
	const areas: RankedArea[] = [];
	for (const [code, record] of Object.entries(edition.data)) {
		const value = definition.map!.valueFor
			? definition.map!.valueFor(
					dataset as never,
					code,
					DEFAULT_MAP_OPTIONS,
				)
			: record[definition.map!.valueKey!];
		if (typeof value !== "number" || !Number.isFinite(value)) continue;
		const ward = definition.boundaryType === "ward";
		const district = ward ? String(record.ladCode ?? "") : code;
		const name = ward
			? String(record.wardName ?? code)
			: councilName(
					gazetteer.get(code)?.name ??
						String(record.ladName ?? record.name ?? code),
				);
		areas.push({ code, name, district, value });
	}
	areas.sort((a, b) => b.value - a.value);
	return {
		map: map.slug,
		level: definition.boundaryType as MapRanking["level"],
		areas,
	};
}

const DISTRICT_PREFIXES: Readonly<Record<string, readonly string[]>> = {
	"GB-ENG": ["E06", "E07", "E08", "E09"],
	"GB-WLS": ["W06"],
	"GB-SCT": ["S12"],
	"GB-NIR": ["N09"],
};

/** The areas of a ranking within a place, in rank order. */
export function areasWithin(
	ranking: MapRanking,
	location: AtlasLocation,
): RankedArea[] {
	if (location.members.length > 0) {
		const members = new Set(location.members);
		return ranking.areas.filter((area) => members.has(area.district));
	}
	const prefixes = location.countries.flatMap(
		(country) => DISTRICT_PREFIXES[country] ?? [],
	);
	return ranking.areas.filter((area) =>
		prefixes.some((prefix) => area.district.startsWith(prefix)),
	);
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
	return definition?.map?.legend.format(value) ?? String(value);
}

/** The place pages a council's row links to, by council code. */
export const COUNCIL_PLACES: ReadonlyMap<string, AtlasLocation> = new Map(
	ATLAS_LOCATIONS.filter((location) => location.members.length === 1).map(
		(location) => [location.members[0], location],
	),
);
