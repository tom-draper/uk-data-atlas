// lib/utils/mapManager/propertyDetector.ts
import {
	CONSTITUENCY_CODE_KEYS,
	LAD_CODE_KEYS,
	WARD_CODE_KEYS,
	BoundaryType,
	WardCodeKey,
	LADCodeKey,
	ConstituencyCodeKey,
} from "@/lib/data/boundaries/boundaries";
import { BoundaryGeojson, PropertyKeys } from "@lib/types";

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

	detectCode(features: BoundaryGeojson["features"]) {
		return this.detectPropertyKey(
			features,
			[
				...WARD_CODE_KEYS,
				...CONSTITUENCY_CODE_KEYS,
				...LAD_CODE_KEYS,
			] as readonly PropertyKeys[],
		);
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

	getYearSpecificCodeKey(
		type: BoundaryType,
		year: number,
	): WardCodeKey | LADCodeKey | ConstituencyCodeKey | undefined {
		// Construct the expected key based on year
		// e.g., for year 2024, expect keys like WD24CD, LAD24CD, PCON24CD
		const yearSuffix = year.toString().slice(-2);

		switch (type) {
			case "ward":
				return WARD_CODE_KEYS.find((key) => key.endsWith(yearSuffix));
			case "localAuthority":
				return LAD_CODE_KEYS.find((key) => key.endsWith(yearSuffix));
			case "constituency":
				// Constituency keys can be a mix of years and prefixes
				// This might need more refined logic if there are complex naming conventions
				return CONSTITUENCY_CODE_KEYS.find((key) => key.endsWith(yearSuffix));
			default:
				return undefined;
		}
	}
}