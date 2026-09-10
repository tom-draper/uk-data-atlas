import type { BoundaryData, WardCodes } from "@lib/types";
import { getFeatureProp } from "@lib/types";
import { BOUNDARY_CATALOG } from "./catalog";

/**
 * Index the ward codes each loaded vintage actually contains. Election data is
 * normalised against this small projection rather than every boundary code.
 */
export const extractWardCodes = (
	boundaryData: BoundaryData,
	isLoading: boolean,
): WardCodes => {
	if (isLoading) return null;

	const codeKeys = BOUNDARY_CATALOG.ward.properties.code;
	const byYear: Record<number, Set<string>> = {};
	for (const [year, data] of Object.entries(boundaryData.ward)) {
		const first = data?.features[0];
		if (!first) continue;
		const codeProp = codeKeys.find(
			(key) => getFeatureProp(first.properties, key) !== undefined,
		);
		if (!codeProp) continue;

		const codes = new Set<string>();
		for (const feature of data.features) {
			const code = getFeatureProp(feature.properties, codeProp);
			if (code) codes.add(code);
		}
		byYear[Number(year)] = codes;
	}
	return byYear;
};
