import type { BoundaryGeojson } from "@lib/types";
import { gazetteer } from "@lib/data/gazetteer/static";
import type { Crosswalk } from "@uk-data-atlas/datasets/data/gazetteer/types";
import { featureExtent } from "./derived";
import { BOUNDARY_CATALOG, type BoundaryType } from "./catalog";
import { boundaryCapabilityFor } from "@uk-data-atlas/datasets/data/boundaries/capabilities";
import {
	getProp,
	countryPrefixForBoundaryCode,
} from "@uk-data-atlas/datasets/data/boundaries/properties";

// ONS LAD25 → CTYUA25 lookup (April 2025, UK, v2).
import localAuthorityCounty from "./localAuthorityCounty.json";
import localAuthorityItl from "./localAuthorityItl.json";

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

export type BoundaryLocationRelations = {
	getLadForWard?: (wardCode: string) => string | undefined;
	constituencyLadOverlaps?: Crosswalk;
	lsoaToLad?: Record<string, string>;
};

export type BoundaryFeatureFilter = {
	location: string | null;
	type: BoundaryType;
	relations?: BoundaryLocationRelations;
};

/** Fast AABB (Axis-Aligned Bounding Box) intersection check. */
const isFeatureInBounds = (
	feature: BoundaryGeojson["features"][number],
	bounds: [number, number, number, number],
): boolean => {
	const [west, south, east, north] = bounds;
	// Properties sidecars omit coordinates, but carry the same compiled extent
	// that the geometry path would calculate. `featureExtent` uses it first and
	// falls back to a cached coordinate walk for full boundary files.
	const featureBounds = featureExtent(feature);

	return (
		featureBounds !== null &&
		featureBounds[0] <= east &&
		featureBounds[2] >= west &&
		featureBounds[1] <= north &&
		featureBounds[3] >= south
	);
};

/** Filter features by the selected named location. */
export const filterFeatures = (
	geojson: BoundaryGeojson,
	{ location, type, relations = {} }: BoundaryFeatureFilter,
): BoundaryGeojson => {
	const { getLadForWard, constituencyLadOverlaps, lsoaToLad } = relations;
	// No filtering needed for UK-wide view
	if (!location || location === "United Kingdom") {
		return geojson;
	}

	const { code: codeKeys } = BOUNDARY_CATALOG[type].properties;
	const capability = boundaryCapabilityFor(type);

	// Filter by country prefix (England, Scotland, Wales, Northern Ireland).
	if (COUNTRY_PREFIXES[location] && capability.countryPrefixFilter) {
		const prefix = COUNTRY_PREFIXES[location];
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const code = getProp(f.properties, codeKeys);
				return (
					code !== undefined &&
					countryPrefixForBoundaryCode(type, code) === prefix
				);
			}),
		};
	}

	const loc = gazetteer.namedLocation(location);
	if (!loc) {
		console.warn(`Location data not found for: ${location}`);
		return geojson;
	}

	if (
		capability.locationScope.kind === "parent-map" &&
		loc.memberCodes?.length
	) {
		const ladCodeSet = new Set(loc.memberCodes);
		const parentMapping = capability.locationScope.mapping;
		if (parentMapping === "lsoaToLad" && !lsoaToLad) {
			// Preserve the previous coarse behaviour if the lookup artifact is
			// temporarily unavailable rather than hiding the whole dataset.
			return loc.bbox
				? {
						...geojson,
						features: geojson.features.filter((f) =>
							isFeatureInBounds(f, loc.bbox!),
						),
					}
				: geojson;
		}
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const areaCode = getProp(f.properties, codeKeys);
				if (parentMapping === "lsoaToLad") {
					return Boolean(
						areaCode &&
						lsoaToLad &&
						ladCodeSet.has(lsoaToLad[areaCode]),
					);
				}
				let ladCode = getProp(
					f.properties,
					BOUNDARY_CATALOG[type].properties.parentCode ??
						BOUNDARY_CATALOG.localAuthority.properties.code,
				);
				const mappedLadCode =
					areaCode && getLadForWard
						? getLadForWard(areaCode)
						: undefined;
				ladCode = ladCode || mappedLadCode;
				return ladCode && ladCodeSet.has(ladCode);
			}),
		};
	}

	if (
		capability.locationScope.kind === "county-membership" &&
		loc.memberCodes?.length
	) {
		const lookup: Record<string, string> = localAuthorityCounty;
		const codes = new Set(
			loc.memberCodes.map((code) => lookup[code] ?? code),
		);
		return {
			...geojson,
			features: geojson.features.filter((feature) =>
				codes.has(getProp(feature.properties, codeKeys) ?? ""),
			),
		};
	}

	if (
		capability.locationScope.kind === "direct-membership" &&
		loc.memberCodes?.length
	) {
		const ladCodeSet = new Set(loc.memberCodes);
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const code = getProp(f.properties, codeKeys);
				return code && ladCodeSet.has(code);
			}),
		};
	}

	if (
		capability.locationScope.kind === "itl-membership" &&
		loc.memberCodes?.length
	) {
		// English regions nest exactly in ITL1, including councils reorganised
		// since the LAD21 lookup. Resolve these by region rather than a box.
		const regionItlCodes: Record<string, string> = {
			E12000001: "TLC",
			E12000002: "TLD",
			E12000003: "TLE",
			E12000004: "TLF",
			E12000005: "TLG",
			E12000006: "TLH",
			E12000007: "TLI",
			E12000008: "TLJ",
			E12000009: "TLK",
		};
		const regionCode =
			loc.kind === "region" && loc.source?.code
				? regionItlCodes[loc.source.code]
				: undefined;
		if (regionCode) {
			return {
				...geojson,
				features: geojson.features.filter((f) =>
					getProp(f.properties, codeKeys)?.startsWith(regionCode),
				),
			};
		}
		// ONS LAD21 → ITL21 lookup. ITL1/2 codes are prefixes of ITL3.
		const lookup: Record<string, string> = localAuthorityItl;
		const length = type === "itl1" ? 3 : type === "itl2" ? 4 : 5;
		const codes = new Set(
			loc.memberCodes.flatMap((code) =>
				lookup[code] ? [lookup[code].slice(0, length)] : [],
			),
		);
		if (codes.size && loc.memberCodes.every((code) => lookup[code])) {
			return {
				...geojson,
				features: geojson.features.filter((f) =>
					codes.has(getProp(f.properties, codeKeys) ?? ""),
				),
			};
		}
	}

	if (
		(capability.locationScope.kind === "bbox" ||
			capability.locationScope.kind === "itl-membership") &&
		loc.bbox
	) {
		return {
			...geojson,
			features: geojson.features.filter((f) =>
				isFeatureInBounds(f, loc.bbox!),
			),
		};
	}

	if (
		capability.locationScope.kind === "crosswalk" &&
		loc.memberCodes?.length &&
		constituencyLadOverlaps
	) {
		const ladCodeSet = new Set(loc.memberCodes);
		return {
			...geojson,
			features: geojson.features.filter((feature) => {
				const constituencyCode = getProp(feature.properties, codeKeys);
				return (
					constituencyLadOverlaps[constituencyCode ?? ""] ?? []
				).some(({ code }) => ladCodeSet.has(code));
			}),
		};
	}

	// A crosswalk is not needed for country-wide locations and remains an
	// optional progressive enhancement if its generated file cannot be served.
	if (capability.locationScope.kind === "crosswalk" && loc.bbox) {
		return {
			...geojson,
			features: geojson.features.filter((f) =>
				isFeatureInBounds(f, loc.bbox!),
			),
		};
	}

	return geojson;
};
