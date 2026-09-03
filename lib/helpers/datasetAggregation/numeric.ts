import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { AggregatedBroadbandData, BroadbandDataset } from "@/lib/types/broadband";
import type { AggregatedAirQualityData, AirQualityDataset } from "@/lib/types/airQuality";
import type { AggregatedClaimantCountData, ClaimantCountDataset } from "@/lib/types/claimantCount";
import type { AggregatedChildPovertyData, ChildPovertyDataset } from "@/lib/types/childPoverty";
import type { AggregatedHomelessnessData, HomelessnessDataset } from "@/lib/types/homelessness";
import type { AggregatedFuelPovertyData, FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { AggregatedSchoolPerformanceData, SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";

/** Collects the numeric dataset records represented by the active boundaries. */
export function collectBoundaryRecords<T>(
	features: Features,
	data: Record<string, T>,
	codeProperty: PropertyKeys,
): T[] {
	const records: T[] = [];
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (record) records.push(record);
	}
	return records;
}

export function aggregateBroadband(
	records: BroadbandDataset["data"][string][],
): AggregatedBroadbandData | null {
	let superfast = 0, ultrafast = 0, fullFibre = 0, gigabit = 0, count = 0;
	for (const record of records) {
		if (record.pctFullFibre == null) continue;
		superfast += record.pctSuperfast ?? 0;
		ultrafast += record.pctUltrafast ?? 0;
		fullFibre += record.pctFullFibre;
		gigabit += record.pctGigabit ?? 0;
		count++;
	}
	return count === 0 ? null : { pctSuperfast: superfast / count, pctUltrafast: ultrafast / count, pctFullFibre: fullFibre / count, pctGigabit: gigabit / count };
}

export function aggregateAirQuality(
	records: AirQualityDataset["data"][string][],
): AggregatedAirQualityData | null {
	let no2 = 0, pm25 = 0, pm10 = 0, count = 0, pm25Count = 0, pm10Count = 0;
	for (const record of records) {
		if (record.no2Mean == null) continue;
		no2 += record.no2Mean;
		if (record.pm25Mean != null) { pm25 += record.pm25Mean; pm25Count++; }
		if (record.pm10Mean != null) { pm10 += record.pm10Mean; pm10Count++; }
		count++;
	}
	return count === 0 ? null : { no2Mean: no2 / count, pm25Mean: pm25Count ? pm25 / pm25Count : null, pm10Mean: pm10Count ? pm10 / pm10Count : null };
}

export function aggregateClaimantCount(
	records: ClaimantCountDataset["data"][string][],
): AggregatedClaimantCountData | null {
	let totalCount = 0, totalRate = 0, youthCount = 0, youthRate = 0, count = 0;
	for (const record of records) {
		totalCount += record.totalCount;
		totalRate += record.totalRate;
		youthCount += record.youthCount;
		youthRate += record.youthRate;
		count++;
	}
	return count === 0 ? null : {
		totalCount,
		totalRate: totalRate / count,
		youthCount,
		youthRate: youthRate / count,
	};
}

export function aggregateChildPoverty(
	records: ChildPovertyDataset["data"][string][],
): AggregatedChildPovertyData | null {
	let childCount = 0, childrenPopulation = 0, count = 0;
	for (const record of records) {
		childCount += record.childCount;
		childrenPopulation += record.childrenPopulation;
		count++;
	}
	return count === 0 || childrenPopulation === 0
		? null
		: { childCount, childPovertyRate: childCount / childrenPopulation * 100 };
}

export function aggregateHomelessness(
	records: HomelessnessDataset["data"][string][],
): AggregatedHomelessnessData | null {
	let householdsInTemporaryAccommodation = 0;
	let householdsPerThousand = 0;
	let householdsWithChildren = 0;
	let childrenInTemporaryAccommodation = 0;
	let count = 0;
	for (const record of records) {
		householdsInTemporaryAccommodation += record.householdsInTemporaryAccommodation;
		householdsPerThousand += record.householdsPerThousand;
		householdsWithChildren += record.householdsWithChildren;
		childrenInTemporaryAccommodation += record.childrenInTemporaryAccommodation;
		count++;
	}
	return count === 0 ? null : {
		householdsInTemporaryAccommodation,
		householdsPerThousand: householdsPerThousand / count,
		householdsWithChildren,
		childrenInTemporaryAccommodation,
	};
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
	return householdCount === 0 ? null : {
		householdCount,
		fuelPoorHouseholdCount,
		fuelPovertyRate: fuelPoorHouseholdCount / householdCount * 100,
	};
}

export function aggregateSchoolPerformance(
	records: SchoolPerformanceDataset["data"][string][],
): AggregatedSchoolPerformanceData | null {
	let pt94 = 0, pt95 = 0, att8 = 0, p8 = 0, count = 0;
	for (const record of records) {
		if (record.ptL2basics94 == null) continue;
		pt94 += record.ptL2basics94;
		pt95 += record.ptL2basics95 ?? 0;
		att8 += record.avgAtt8 ?? 0;
		p8 += record.avgP8score ?? 0;
		count++;
	}
	return count === 0 ? null : {
		ptL2basics94: pt94 / count,
		ptL2basics95: pt95 / count,
		avgAtt8: att8 / count,
		avgP8score: p8 / count,
	};
}
