import { gazetteer } from "./gazetteer/static";
import type { Crosswalk } from "./gazetteer/types";
import { BOUNDARY_CATALOG, type BoundaryType } from "./boundaries/catalog";
import { boundaryCapabilityFor } from "./boundaries/capabilities";
import { getProp } from "./boundaries/properties";
import { withCDN } from "../helpers/cdn";
import { codeKeyedFieldsFor, type DatasetPayloadLayout } from "./catalog/types";

export type DatasetLocationFilter = {
	location: string;
	boundaryType: BoundaryType;
	payloadLayout?: DatasetPayloadLayout;
	includeLocationPopulationSummary?: boolean;
};

type DatasetRecord = {
	boundaryYear?: number;
	data?: Record<string, unknown>;
	results?: Record<string, unknown>;
	locationPopulations?: Record<string, number>;
	locationAggregate?: unknown;
	locationAggregates?: Record<string, unknown>;
	[key: string]: unknown;
};

type CodeMatcher = (code: string) => boolean;

/**
 * Records can be keyed by a geography other than the displayed boundary. Keep
 * the mapped records reached by the selected boundary codes when slicing.
 */
const mappedCodesForLocation = (
	dataset: DatasetRecord,
	matcher: CodeMatcher,
	layout?: DatasetPayloadLayout,
): Set<string> | null => {
	const scope = layout?.locationScope;
	if (scope?.kind !== "mapped") return null;
	const mapping = dataset[scope.mappingField];
	if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
		return null;

	return new Set(
		Object.entries(mapping).flatMap(([boundaryCode, recordCode]) =>
			matcher(boundaryCode) && typeof recordCode === "string"
				? [recordCode]
				: [],
		),
	);
};

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

const populationTotal = (record: unknown): number => {
	if (!record || typeof record !== "object") return 0;
	const total = Reflect.get(record, "total");
	if (!total || typeof total !== "object") return 0;
	return Object.values(total as Record<string, unknown>).reduce<number>(
		(sum, value) => sum + (typeof value === "number" ? value : 0),
		0,
	);
};

const locationPopulationSummary = (data: Record<string, unknown>) => {
	const byLad = new Map<string, number>();
	const countries: Record<string, number> = {
		"United Kingdom": 0,
		England: 0,
		Scotland: 5_479_900,
		Wales: 0,
		"Northern Ireland": 1_903_175,
	};

	for (const [wardCode, record] of Object.entries(data)) {
		const population = populationTotal(record);
		countries["United Kingdom"] += population;
		if (wardCode.startsWith("E")) countries.England += population;
		else if (wardCode.startsWith("S")) countries.Scotland += population;
		else if (wardCode.startsWith("W")) countries.Wales += population;
		else if (wardCode.startsWith("N"))
			countries["Northern Ireland"] += population;

		const ladCode =
			record && typeof record === "object"
				? Reflect.get(record, "ladCode")
				: undefined;
		if (typeof ladCode === "string")
			byLad.set(ladCode, (byLad.get(ladCode) ?? 0) + population);
	}

	return Object.fromEntries(
		gazetteer.namedLocations().map((location) => {
			if (location in countries) return [location, countries[location]!];
			const total = (
				gazetteer.namedLocation(location)?.memberCodes ?? []
			).reduce((sum, ladCode) => sum + (byLad.get(ladCode) ?? 0), 0);
			return [location, total];
		}),
	);
};
const BOUNDARY_MAPPINGS_URL = withCDN(
	"/data/precompiled/boundary-mappings.json",
);
const CONSTITUENCY_LAD_OVERLAPS_URL = withCDN(
	"/data/precompiled/constituency-lad-overlaps.json",
);

let wardToLadPending: Promise<Record<string, string>> | null = null;
let constituencyOverlapsPending: Promise<Record<string, Crosswalk>> | null =
	null;
const bboxMatcherPending = new Map<string, Promise<CodeMatcher | null>>();

const fetchWardToLad = () => {
	if (!wardToLadPending) {
		wardToLadPending = fetch(BOUNDARY_MAPPINGS_URL)
			.then(async (response) => {
				if (!response.ok)
					throw new Error(
						`Failed to fetch ward/LAD mappings: ${response.status} ${response.statusText}`,
					);
				const mappings = (await response.json()) as {
					wardToLad?: Record<string, string>;
				};
				return mappings.wardToLad ?? {};
			})
			.catch((error) => {
				wardToLadPending = null;
				throw error;
			});
	}
	return wardToLadPending;
};

const fetchConstituencyOverlaps = () => {
	if (!constituencyOverlapsPending) {
		constituencyOverlapsPending = fetch(CONSTITUENCY_LAD_OVERLAPS_URL)
			.then(async (response) => {
				if (!response.ok)
					throw new Error(
						`Failed to fetch constituency/LAD overlaps: ${response.status} ${response.statusText}`,
					);
				const overlaps = (await response.json()) as {
					releases?: Record<string, Crosswalk>;
				};
				return overlaps.releases ?? {};
			})
			.catch((error) => {
				constituencyOverlapsPending = null;
				throw error;
			});
	}
	return constituencyOverlapsPending;
};

const intersects = (a: readonly number[], b: readonly number[]) =>
	a[0]! <= b[2]! && a[2]! >= b[0]! && a[1]! <= b[3]! && a[3]! >= b[1]!;

const bboxMatcherFor = (
	type: BoundaryType,
	year: number,
	bbox: readonly number[],
): Promise<CodeMatcher | null> => {
	const path = BOUNDARY_CATALOG[type].propertyVintages[year];
	if (!path) return Promise.resolve(null);
	const cacheKey = `${path}\u0000${bbox.join(",")}`;
	const cached = bboxMatcherPending.get(cacheKey);
	if (cached) return cached;

	const pending = fetch(path)
		.then(async (response) => {
			if (!response.ok)
				throw new Error(
					`Failed to fetch ${type} properties: ${response.status} ${response.statusText}`,
				);
			const file = (await response.json()) as {
				features?: Record<string, unknown>[];
			};
			const codes = new Set(
				(file.features ?? []).flatMap((properties) => {
					const featureBbox = properties.bbox;
					const code = getProp(
						properties,
						BOUNDARY_CATALOG[type].properties.code,
					);
					return Array.isArray(featureBbox) &&
						featureBbox.length === 4 &&
						featureBbox.every(
							(value) => typeof value === "number",
						) &&
						code &&
						intersects(featureBbox as number[], bbox)
						? [code]
						: [];
				}),
			);
			return (code: string) => codes.has(code);
		})
		.catch((error) => {
			bboxMatcherPending.delete(cacheKey);
			throw error;
		});
	bboxMatcherPending.set(cacheKey, pending);
	return pending;
};

const constituencyReleaseForYear = (year: number) => {
	const asset = BOUNDARY_CATALOG.constituency.vintages[year];
	return BOUNDARY_CATALOG.constituency.releases.find(
		(release) => release.asset === asset,
	)?.id;
};

const matcherFor = async (
	filter: DatasetLocationFilter,
	year: number | undefined,
): Promise<CodeMatcher | null> => {
	if (!filter.location || filter.location === "United Kingdom") return null;
	const capability = boundaryCapabilityFor(filter.boundaryType);
	const countryPrefix = COUNTRY_PREFIXES[filter.location];
	if (countryPrefix && capability.countryPrefixFilter)
		return (code) => code.startsWith(countryPrefix);

	const location = gazetteer.namedLocation(filter.location);
	if (!location) return null;
	const memberCodes = new Set(location.memberCodes ?? []);

	switch (capability.locationScope.kind) {
		case "direct-membership":
			return memberCodes.size > 0
				? (code) => memberCodes.has(code)
				: null;
		case "parent-map": {
			if (memberCodes.size === 0) return null;
			const wardToLad = await fetchWardToLad();
			return (code) => memberCodes.has(wardToLad[code] ?? "");
		}
		case "crosswalk": {
			if (memberCodes.size === 0 || year === undefined) return null;
			const release = constituencyReleaseForYear(year);
			const overlaps = release
				? (await fetchConstituencyOverlaps())[release]
				: undefined;
			if (!overlaps) return null;
			return (code) =>
				(overlaps[code] ?? []).some(({ code: ladCode }) =>
					memberCodes.has(ladCode),
				);
		}
		case "bbox":
			return location.bbox && year !== undefined
				? bboxMatcherFor(filter.boundaryType, year, location.bbox)
				: null;
		case "none":
			return null;
	}

	return null;
};

/**
 * Keep the records needed by cards and map hovers in one selected location.
 * The worker parses a complete source document, but only this compact slice is
 * transferred to and retained by the UI thread.
 */
export const filterDatasetPayloadForLocation = async (
	payload: unknown,
	filter?: DatasetLocationFilter,
): Promise<unknown> => {
	if (!filter || typeof payload !== "object" || payload === null)
		return payload;

	const entries = await Promise.all(
		Object.entries(payload as Record<string, DatasetRecord>).map(
			async ([id, dataset]) => {
				if (
					!dataset.data ||
					typeof dataset.data !== "object" ||
					Array.isArray(dataset.data)
				)
					return [id, dataset] as const;
				const { locationAggregates, ...datasetWithoutAggregates } =
					dataset;
				const scopedDataset = locationAggregates
					? {
							...datasetWithoutAggregates,
							...(locationAggregates[filter.location] !==
								undefined && {
								locationAggregate:
									locationAggregates[filter.location],
							}),
						}
					: dataset;
				const matcher = await matcherFor(filter, dataset.boundaryYear);
				const locationPopulations =
					filter.includeLocationPopulationSummary
						? (dataset.locationPopulations ??
							locationPopulationSummary(dataset.data))
						: undefined;
				if (!matcher)
					return [
						id,
						locationPopulations
							? { ...scopedDataset, locationPopulations }
							: scopedDataset,
					] as const;
				const scopedFields: Record<
					string,
					Record<string, unknown>
				> = {};
				const mappedCodes = mappedCodesForLocation(
					dataset,
					matcher,
					filter.payloadLayout,
				);
				for (const field of codeKeyedFieldsFor(filter.payloadLayout)) {
					const records = dataset[field];
					if (!records || typeof records !== "object") continue;
					scopedFields[field] = Object.fromEntries(
						Object.entries(records).filter(
							([code]) =>
								matcher(code) ||
								(field === "data" && mappedCodes?.has(code)),
						),
					);
				}
				return [
					id,
					{
						...scopedDataset,
						...(locationPopulations && { locationPopulations }),
						...scopedFields,
					},
				] as const;
			},
		),
	);
	return Object.fromEntries(entries);
};
