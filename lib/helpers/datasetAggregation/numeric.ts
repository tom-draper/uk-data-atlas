import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { AggregatedBroadbandData, BroadbandDataset } from "@/lib/types/broadband";
import type { AggregatedAirQualityData, AirQualityDataset } from "@/lib/types/airQuality";

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
