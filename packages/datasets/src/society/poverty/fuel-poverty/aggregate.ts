import type {
	AggregatedFuelPovertyData,
	FuelPovertyLSOAData,
} from "../../../types/fuelPoverty.ts";

/** Pools households before taking a rate, as a rate cannot be averaged. */
export function aggregateFuelPoverty(
	records: FuelPovertyLSOAData[],
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
