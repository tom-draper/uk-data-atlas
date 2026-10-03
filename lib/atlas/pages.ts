import { gazetteer } from "@/lib/data/gazetteer/static";
import type { PlaceKind } from "@/lib/data/gazetteer/places";
import type { DatasetSource } from "@/lib/data/catalog/types";
import { CHART_DATASET_DEFINITIONS, datasetSlug } from "@/lib/datasets";
import type { ChartDatasetType } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import {
	activeVizFromReference,
	parseVisualizationRef,
	visualizationRefFromActiveViz,
} from "@/lib/helpers/visualization";
import type { ActiveViz, VizView } from "@/lib/types";
import type { DatasetCountry } from "@/lib/types/coverage";

/**
 * Every atlas map has its own page, `/atlas/{location}/{map}`, so search
 * engines can list each one under its own title. The path names what and
 * where; `?period=` names when, and is left off for the newest period.
 */

const ALL_COUNTRIES: readonly DatasetCountry[] = [
	"GB-ENG",
	"GB-WLS",
	"GB-SCT",
	"GB-NIR",
];

/** Coverage for the datasets whose catalogue entry does not declare it. */
const COVERAGE_OVERRIDES: Partial<
	Record<ChartDatasetType, readonly DatasetCountry[]>
> = {
	fuelPoverty: ["GB-ENG"],
	imd: ["GB-ENG"],
	nimdm: ["GB-NIR"],
	simd: ["GB-SCT"],
	wimd: ["GB-WLS"],
};

/** What each map shows, as people search for it. Keyed by map slug. */
export const MAP_NAMES: Readonly<Record<string, string>> = {
	"adult-social-care-activity": "Adult Social Care Support",
	"adult-social-care-outcomes": "Adult Social Care Quality of Life",
	"air-quality": "Air Pollution (NO₂)",
	brexit: "EU Referendum Results",
	"brexit-constituency": "EU Referendum Estimates by Constituency",
	broadband: "Broadband Coverage",
	"business-activity": "Businesses",
	"car-availability": "Car Ownership",
	"child-poverty": "Child Poverty",
	"claimant-count": "Claimant Count",
	"council-tax": "Council Tax",
	crime: "Crime Rates",
	"electric-vehicle-chargers": "EV Charging Points",
	ethnicity: "Ethnicity",
	"fuel-poverty": "Fuel Poverty",
	"general-election": "General Election Results",
	"ghg-emissions": "Greenhouse Gas Emissions",
	homelessness: "Homelessness",
	"house-price": "House Prices",
	"housing-affordability": "Housing Affordability",
	imd: "Deprivation (IMD)",
	income: "Income",
	"life-expectancy": "Life Expectancy",
	"healthy-life-expectancy": "Healthy Life Expectancy",
	"local-election": "Local Election Results",
	"local-government-finance": "Council Education Spending",
	"mobile-coverage": "Mobile Coverage",
	"net-additional-dwellings": "New Homes",
	"nhs-waiting": "NHS Waiting Times",
	nimdm: "Deprivation (NIMDM)",
	"planning-applications": "Planning Applications",
	"population-density": "Population Density",
	"population-age": "Age Distribution",
	"population-gender": "Gender Balance",
	qualification: "Qualifications",
	"school-performance": "GCSE Results",
	"school-performance-gap": "Disadvantaged Pupil Attainment Gap",
	simd: "Deprivation (SIMD)",
	"travel-to-work": "Commuting",
	unemployment: "Unemployment",
	waste: "Household Waste",
	wimd: "Deprivation (WIMD)",
};

const AREA_NOUNS: Readonly<Record<string, string>> = {
	ward: "ward",
	localAuthority: "local authority",
	constituency: "constituency",
	lsoa: "neighbourhood",
	dataZone: "data zone",
	superOutputArea: "super output area",
};

export type AtlasMap = {
	slug: string;
	/** The public dataset identifier, as used by `?dataset=`. */
	dataset: string;
	view?: VizView;
	name: string;
	group: string;
	/** Newest first; the first is the page's default. */
	periods: readonly number[];
	countries: readonly DatasetCountry[];
	/** The area the map is coloured by, e.g. "ward". */
	areaNoun: string;
	source: DatasetSource;
};

export type AtlasLocation = {
	name: string;
	slug: string;
	countries: readonly DatasetCountry[];
	/** Its local authorities; empty for a nation or the UK. */
	members: readonly string[];
	/** A council is a place of its own, alongside the atlas's curated places. */
	kind: PlaceKind;
};

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['’.]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function mapSlug(dataset: string, view?: VizView): string {
	if (!view) return dataset;
	return view.includes(dataset) ? view : `${dataset}-${view}`;
}

function buildMaps(): AtlasMap[] {
	const maps = new Map<string, AtlasMap>();
	for (const definition of CHART_DATASET_DEFINITIONS) {
		const dataset = datasetSlug(definition.type);
		for (const chart of getChartDefinitions(definition)) {
			const slug = mapSlug(dataset, chart.view);
			const existing = maps.get(slug);
			if (existing) {
				existing.periods = [...existing.periods, chart.year].sort(
					(a, b) => b - a,
				);
				continue;
			}
			maps.set(slug, {
				slug,
				dataset,
				...(chart.view ? { view: chart.view } : {}),
				name: MAP_NAMES[slug] ?? definition.source.name,
				group: chart.group,
				periods: [chart.year],
				countries:
					definition.coverageCountries ??
					COVERAGE_OVERRIDES[definition.type as ChartDatasetType] ??
					ALL_COUNTRIES,
				areaNoun:
					AREA_NOUNS[definition.boundaryType] ??
					definition.boundaryType,
				source: definition.source,
			});
		}
	}
	return [...maps.values()];
}

const NATION_COUNTRIES: Readonly<Record<string, readonly DatasetCountry[]>> = {
	England: ["GB-ENG"],
	Wales: ["GB-WLS"],
	Scotland: ["GB-SCT"],
	"Northern Ireland": ["GB-NIR"],
	"United Kingdom": ALL_COUNTRIES,
};

const COUNTRY_BY_CODE_PREFIX: Readonly<Record<string, DatasetCountry>> = {
	E: "GB-ENG",
	W: "GB-WLS",
	S: "GB-SCT",
	N: "GB-NIR",
};

function buildLocations(): AtlasLocation[] {
	const names = [
		...gazetteer.namedLocations(),
		...gazetteer.councilLocations(),
	];
	return names.map((name) => {
		const place = gazetteer.namedLocation(name)!;
		const members = place.memberCodes;
		const countries = NATION_COUNTRIES[name] ?? [
			...new Set(members.map((code) => COUNTRY_BY_CODE_PREFIX[code[0]])),
		];
		return {
			name,
			slug: slugify(name),
			countries,
			members,
			kind: place.kind,
		};
	});
}

export const ATLAS_MAPS: readonly AtlasMap[] = buildMaps();
export const ATLAS_LOCATIONS: readonly AtlasLocation[] = buildLocations();

const mapsBySlug = new Map(ATLAS_MAPS.map((map) => [map.slug, map]));
const locationsBySlug = new Map(
	ATLAS_LOCATIONS.map((location) => [location.slug, location]),
);
const locationsByName = new Map(
	ATLAS_LOCATIONS.map((location) => [location.name, location]),
);

export const findAtlasMap = (slug: string) => mapsBySlug.get(slug);
export const findAtlasLocation = (slug: string) => locationsBySlug.get(slug);
export const atlasLocationNamed = (name: string) => locationsByName.get(name);

/** The map a dataset and view select; a dataset alone gets its first map. */
export function atlasMapFor(dataset: string, view?: VizView) {
	return (
		mapsBySlug.get(mapSlug(dataset, view)) ??
		ATLAS_MAPS.find((map) => map.dataset === dataset)
	);
}

/**
 * Whether a map has a page for a location. A UK page needs data from more
 * than one nation; a single nation's map belongs on that nation's page.
 */
export function atlasMapCovers(map: AtlasMap, location: AtlasLocation) {
	if (location.countries.length === ALL_COUNTRIES.length)
		return map.countries.length > 1;
	return location.countries.every((country) =>
		map.countries.includes(country),
	);
}

export function atlasMapsFor(location: AtlasLocation): AtlasMap[] {
	return ATLAS_MAPS.filter((map) => atlasMapCovers(map, location));
}

export function atlasLocationsFor(map: AtlasMap): AtlasLocation[] {
	return ATLAS_LOCATIONS.filter((location) => atlasMapCovers(map, location));
}

export function atlasVizFor(map: AtlasMap, period?: number): ActiveViz {
	const year =
		period !== undefined && map.periods.includes(period)
			? period
			: map.periods[0];
	// Every map comes from a chart definition, so its reference resolves.
	return activeVizFromReference({
		dataset: map.dataset,
		period: year,
		...(map.view ? { view: map.view } : {}),
	})!;
}

/** The atlas URL for a selection: its page, plus any non-default period. */
export function atlasHref(locationName: string, viz: ActiveViz): string {
	const location = atlasLocationNamed(locationName);
	if (!location) return "/atlas";
	const reference = visualizationRefFromActiveViz(viz);
	const map = reference && atlasMapFor(reference.dataset, reference.view);
	if (!reference || !map) return `/atlas/${location.slug}`;
	const path = `/atlas/${location.slug}/${map.slug}`;
	return reference.period === map.periods[0]
		? path
		: `${path}?period=${reference.period}`;
}

export function locationLabel(location: AtlasLocation) {
	return location.name === "United Kingdom"
		? "the United Kingdom"
		: location.name;
}

export function atlasMapTitle(map: AtlasMap, period = map.periods[0]) {
	return map.periods.length > 1 ? `${period} ${map.name}` : map.name;
}

/** "Population Density in London". */
export function atlasPageHeading(
	location: AtlasLocation,
	map: AtlasMap,
	period?: number,
) {
	return `${atlasMapTitle(map, period)} in ${locationLabel(location)}`;
}

/**
 * The search snippet. A headline figure for the place, when there is one,
 * leads, since a snippet shows only its first 150 or so characters.
 */
export function atlasPageDescription(
	location: AtlasLocation,
	map: AtlasMap,
	figure?: string | null,
) {
	if (figure)
		return `${figure} Explore the interactive ${map.areaNoun} map of ${atlasMapTitle(map)} with ${map.source.source} data.`;
	return `Interactive map of ${atlasMapTitle(map)} across ${locationLabel(location)}, by ${map.areaNoun}. Explore and compare areas with ${map.source.source} data (${map.source.year}).`;
}

/** The heading for a live atlas selection, e.g. "Population Density in London". */
export function atlasHeading(locationName: string, viz: ActiveViz) {
	const location = atlasLocationNamed(locationName);
	const reference = visualizationRefFromActiveViz(viz);
	const map = reference && atlasMapFor(reference.dataset, reference.view);
	if (!location) return locationName;
	if (!reference || !map) return location.name;
	return atlasPageHeading(location, map, reference.period);
}

/** The browse page for a place's maps, when it has one. */
export function atlasMapsHref(locationName: string) {
	const location = atlasLocationNamed(locationName);
	return location ? `/maps/${location.slug}` : null;
}

export const DEFAULT_ACTIVE_VIZ: ActiveViz = {
	datasetId: "localElection2024",
	datasetType: "localElection",
	datasetYear: 2024,
};

export const DEFAULT_LOCATION = "Greater Manchester";

/** The selection a page opens with: its path's slugs and any `?period=`. */
export function atlasInitialState(
	page: { location?: string; map?: string },
	period: string | null,
): { activeViz: ActiveViz; selectedLocation: string } {
	const location = page.location
		? findAtlasLocation(page.location)
		: undefined;
	const map = page.map ? findAtlasMap(page.map) : undefined;
	return {
		activeViz: map
			? atlasVizFor(map, period === null ? undefined : Number(period))
			: DEFAULT_ACTIVE_VIZ,
		selectedLocation: location?.name ?? DEFAULT_LOCATION,
	};
}

/**
 * The page a shared `/atlas?location=…&dataset=…` link now lives at, or null
 * when the query names no selection.
 */
export function legacyAtlasHref(params: URLSearchParams): string | null {
	if (!params.has("location") && !params.has("dataset")) return null;
	const reference = parseVisualizationRef(params);
	const activeViz =
		(reference && activeVizFromReference(reference)) ?? DEFAULT_ACTIVE_VIZ;
	return atlasHref(params.get("location") ?? DEFAULT_LOCATION, activeViz);
}
