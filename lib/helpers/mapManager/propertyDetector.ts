// lib/utils/mapManager/propertyDetector.ts
import {
	CONSTITUENCY_CODE_KEYS,
	DATA_ZONE_CODE_KEYS,
	LAD_CODE_KEYS,
	LSOA_CODE_KEYS,
	WARD_CODE_KEYS,
	SOA_CODE_KEYS,
	WardCodeKey,
} from "@/lib/data/boundaries/boundaries";
import { BoundaryGeojson, PropertyKeys } from "@lib/types";

// Detects which ward code property key is present in a GeoJSON, preferring the
// key that matches the dataset boundary year before falling back to any available key.
export function detectWardCodeForYear(
	features: BoundaryGeojson["features"],
	year: number,
): WardCodeKey {
	const firstFeature = features[0];
	if (!firstFeature) return WARD_CODE_KEYS[0];

	const yearSuffix = year.toString().slice(-2);
	const specificKey = WARD_CODE_KEYS.find(
		(key) => key === `WD${yearSuffix}CD`,
	);
	if (specificKey && specificKey in firstFeature.properties)
		return specificKey;

	for (const key of WARD_CODE_KEYS) {
		if (key in firstFeature.properties) return key;
	}
	return WARD_CODE_KEYS[0];
}

export class PropertyDetector {
	detectWardCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, WARD_CODE_KEYS);
	}

	detectConstituencyCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, CONSTITUENCY_CODE_KEYS);
	}

	detectLocalAuthorityCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, LAD_CODE_KEYS);
	}

	detectLSOACode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, LSOA_CODE_KEYS);
	}

	detectDataZoneCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, DATA_ZONE_CODE_KEYS);
	}

	detectSOACode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, SOA_CODE_KEYS);
	}

	detectCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(features, [
			...WARD_CODE_KEYS,
			...CONSTITUENCY_CODE_KEYS,
			...LAD_CODE_KEYS,
			...LSOA_CODE_KEYS,
			...DATA_ZONE_CODE_KEYS,
			...SOA_CODE_KEYS,
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
