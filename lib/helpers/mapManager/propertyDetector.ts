// lib/utils/mapManager/propertyDetector.ts
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import { BoundaryGeojson, PropertyKeys } from "@lib/types";

const { ward, constituency, localAuthority, lsoa, dataZone, superOutputArea } =
	BOUNDARY_CATALOG;
type WardCodeKey = (typeof ward.properties.code)[number];

// Detects which ward code property key is present in a GeoJSON, preferring the
// key that matches the dataset boundary year before falling back to any available key.
export function detectWardCodeForYear(
	features: BoundaryGeojson["features"],
	year: number,
): WardCodeKey {
	const firstFeature = features[0];
	if (!firstFeature) return ward.properties.code[0];

	const yearSuffix = year.toString().slice(-2);
	const specificKey = ward.properties.code.find(
		(key) => key === `WD${yearSuffix}CD`,
	);
	if (specificKey && specificKey in firstFeature.properties)
		return specificKey;

	for (const key of ward.properties.code) {
		if (key in firstFeature.properties) return key;
	}
	return ward.properties.code[0];
}

export class PropertyDetector {
	detectWardCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, ward.properties.code);
	}

	detectConstituencyCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, constituency.properties.code);
	}

	detectLocalAuthorityCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, localAuthority.properties.code);
	}

	detectLSOACode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, lsoa.properties.code);
	}

	detectDataZoneCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, dataZone.properties.code);
	}

	detectSOACode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, superOutputArea.properties.code);
	}

	detectCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, [
			...ward.properties.code,
			...constituency.properties.code,
			...localAuthority.properties.code,
			...lsoa.properties.code,
			...dataZone.properties.code,
			...superOutputArea.properties.code,
		] as readonly PropertyKeys[]);
	}

	private detectPropertyKey(
		features: BoundaryGeojson["features"],
		possibleKeys: readonly PropertyKeys[],
	) {
		const firstFeature = features[0];
		if (!firstFeature) return possibleKeys[0];

		for (const key of possibleKeys) {
			if (key in firstFeature.properties) {
				return key;
			}
		}

		return possibleKeys[0];
	}
}
