import { gazetteer } from "./gazetteer/static";
import type { Crosswalk } from "./gazetteer/types";
import { BOUNDARY_CATALOG, type BoundaryType } from "./boundaries/catalog";
import { getProp } from "./boundaries/properties";
import { withCDN } from "../helpers/cdn";

export type DatasetLocationFilter = {
	location: string;
	boundaryType: BoundaryType;
};

type DatasetRecord = {
	boundaryYear?: number;
	data?: Record<string, unknown>;
	[key: string]: unknown;
};

type CodeMatcher = (code: string) => boolean;

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
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
	type: Extract<BoundaryType, "lsoa" | "dataZone" | "superOutputArea">,
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
	const countryPrefix = COUNTRY_PREFIXES[filter.location];
	if (countryPrefix) return (code) => code.startsWith(countryPrefix);

	const location = gazetteer.namedLocation(filter.location);
	if (!location) return null;
	const memberCodes = new Set(location.memberCodes ?? []);

	if (filter.boundaryType === "localAuthority" && memberCodes.size > 0) {
		return (code) => memberCodes.has(code);
	}
	if (filter.boundaryType === "ward" && memberCodes.size > 0) {
		const wardToLad = await fetchWardToLad();
		return (code) => memberCodes.has(wardToLad[code] ?? "");
	}
	if (
		filter.boundaryType === "constituency" &&
		memberCodes.size > 0 &&
		year !== undefined
	) {
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
	if (
		(filter.boundaryType === "lsoa" ||
			filter.boundaryType === "dataZone" ||
			filter.boundaryType === "superOutputArea") &&
		location.bbox &&
		year !== undefined
	) {
		return bboxMatcherFor(filter.boundaryType, year, location.bbox);
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
				const matcher = await matcherFor(filter, dataset.boundaryYear);
				if (!matcher) return [id, dataset] as const;
				return [
					id,
					{
						...dataset,
						data: Object.fromEntries(
							Object.entries(dataset.data).filter(([code]) =>
								matcher(code),
							),
						),
					},
				] as const;
			},
		),
	);
	return Object.fromEntries(entries);
};
