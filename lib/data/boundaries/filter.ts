import type { BoundaryGeojson } from "@lib/types";
import { gazetteer } from "@lib/data/gazetteer/static";
import type { Crosswalk } from "../gazetteer/types";
import { featureExtent } from "./derived";
import { BOUNDARY_CATALOG, type BoundaryType } from "./catalog";
import { boundaryCapabilityFor } from "./capabilities";
import { getProp } from "./properties";

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
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
	location: string | null,
	type: BoundaryType,
	getLadForWard?: (wardCode: string) => string | undefined,
	constituencyLadOverlaps?: Crosswalk,
): BoundaryGeojson => {
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
				return code?.startsWith(prefix);
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
		return {
			...geojson,
			features: geojson.features.filter((f) => {
				const wardCode = getProp(f.properties, codeKeys);
				let ladCode = getProp(
					f.properties,
					BOUNDARY_CATALOG[type].properties.parentCode ??
						BOUNDARY_CATALOG.localAuthority.properties.code,
				);
				const mappedLadCode =
					wardCode && getLadForWard
						? getLadForWard(wardCode)
						: undefined;
				ladCode = ladCode || mappedLadCode;
				return ladCode && ladCodeSet.has(ladCode);
			}),
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

	if (capability.locationScope.kind === "bbox" && loc.bbox) {
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
