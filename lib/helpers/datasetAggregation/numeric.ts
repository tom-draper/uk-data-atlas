import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type {} from "@uk-data-atlas/datasets";
import { denominator, weightedMean } from "@uk-data-atlas/datasets";

export { weightedMean };
import type {} from "@uk-data-atlas/datasets";
import type {
	AggregatedFuelPovertyData,
	FuelPovertyDataset,
} from "@uk-data-atlas/datasets";
import type {} from "@uk-data-atlas/datasets";
import type { SchoolPerformanceGapMeasures } from "@uk-data-atlas/datasets";

/** Collects the numeric dataset records represented by the active boundaries. */
export function collectBoundaryRecords<T>(
	features: Features,
	data: Record<string, T>,
	codeProperty: PropertyKeys,
	/** Take each code's record once, as a split boundary can repeat a code. */
	distinct = false,
): T[] {
	const records: T[] = [];
	const seen = new Set<string>();
	for (const feature of features) {
		const code = getFeatureProp(feature.properties, codeProperty) ?? "";
		if (distinct) {
			if (seen.has(code)) continue;
			seen.add(code);
		}
		const record = data[code];
		if (record) records.push(record);
	}
	return records;
}

export function aggregateFuelPoverty(
	records: FuelPovertyDataset["data"][string][],
): AggregatedFuelPovertyData | null {
	let householdCount = 0;
	let fuelPoorHouseholdCount = 0;
	for (const record of records) {
		householdCount += record.householdCount;
		fuelPoorHouseholdCount += record.fuelPoorHouseholdCount;
	}
	return householdCount === 0
		? null
		: {
				householdCount,
				fuelPoorHouseholdCount,
				fuelPovertyRate:
					(fuelPoorHouseholdCount / householdCount) * 100,
			};
}
