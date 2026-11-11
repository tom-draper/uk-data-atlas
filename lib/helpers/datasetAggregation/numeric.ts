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
import type {
	AggregatedSchoolPerformanceData,
	SchoolPerformanceGapMeasures,
	SchoolPerformanceMeasures,
} from "@uk-data-atlas/datasets";
import type {
	AggregatedEnergyConsumptionData,
	EnergyConsumptionLADData,
} from "@uk-data-atlas/datasets";

/** Collects the numeric dataset records represented by the active boundaries. */
export function collectBoundaryRecords<T>(
	features: Features,
	data: Record<string, T>,
	codeProperty: PropertyKeys,
): T[] {
	const records: T[] = [];
	for (const feature of features) {
		const record =
			data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (record) records.push(record);
	}
	return records;
}

/** Metered energy use is a total, so every component adds across authorities. */
export function aggregateEnergyConsumption(
	records: EnergyConsumptionLADData[],
): AggregatedEnergyConsumptionData | null {
	if (records.length === 0) return null;
	return records.reduce<AggregatedEnergyConsumptionData>(
		(total, record) => ({
			domesticGwh: total.domesticGwh + record.domesticGwh,
			nonDomesticGwh: total.nonDomesticGwh + record.nonDomesticGwh,
			allMetersGwh: total.allMetersGwh + record.allMetersGwh,
			metersThousands: total.metersThousands + record.metersThousands,
		}),
		{
			domesticGwh: 0,
			nonDomesticGwh: 0,
			allMetersGwh: 0,
			metersThousands: 0,
		},
	);
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

// Reads only the headline measures, so it serves both the local authority
// district and the parliamentary constituency datasets.
export function aggregateSchoolPerformance(
	records: SchoolPerformanceMeasures[],
): AggregatedSchoolPerformanceData | null {
	// Each figure is a share or an average over the area's pupils, so
	// authorities count by how many pupils they have.
	const reporting = records.filter((record) => record.ptL2basics94 != null);
	const pupils = (record: SchoolPerformanceMeasures) => record.pupils;
	const ptL2basics94 = weightedMean(
		reporting,
		(record) => record.ptL2basics94,
		pupils,
	);
	return ptL2basics94 === null
		? null
		: {
				ptL2basics94,
				ptL2basics95: weightedMean(
					reporting,
					(record) => record.ptL2basics95,
					pupils,
				),
				avgAtt8: weightedMean(
					reporting,
					(record) => record.avgAtt8,
					pupils,
				),
				avgP8score: weightedMean(
					reporting,
					(record) => record.avgP8score,
					pupils,
				),
			};
}
