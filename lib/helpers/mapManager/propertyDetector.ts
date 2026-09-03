// lib/utils/mapManager/propertyDetector.ts
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import {
	BoundaryGeojson,
	BoundaryType,
	Features,
	PropertyKeys,
} from "@lib/types";

const { ward } = BOUNDARY_CATALOG;
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

/**
 * The geography whose code key to look for, or "any" for boundary files whose
 * geography isn't known ahead of time (custom uploads).
 */
export type BoundaryCodeScope = BoundaryType | "any";

// Catalogue order decides which geography wins when a file carries code keys
// for several of them.
const ANY_CODE_KEYS = Object.values(BOUNDARY_CATALOG).flatMap(
	(family) => family.properties.code,
) as readonly PropertyKeys[];

const codeKeysFor = (scope: BoundaryCodeScope): readonly PropertyKeys[] =>
	scope === "any" ? ANY_CODE_KEYS : BOUNDARY_CATALOG[scope].properties.code;

export class PropertyDetector {
	/** The code property key a boundary file uses for the given geography. */
	detect(scope: BoundaryCodeScope, features: Features): PropertyKeys {
		const keys = codeKeysFor(scope);
		const properties = features[0]?.properties;
		if (!properties) return keys[0];

		for (const key of keys) {
			if (key in properties) return key;
		}
		return keys[0];
	}
}
