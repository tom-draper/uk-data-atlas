import { weightedMean } from "../../helpers/rates.ts";
import type {
	AggregatedAirQualityData,
	AirQualityLADData,
} from "../../types/airQuality.ts";

/**
 * Each authority's concentration is a mean over its 1x1 km grid cells, so
 * weighting by cell count gives the mean over every cell in the combined area.
 */
export function aggregateAirQuality(
	records: AirQualityLADData[],
): AggregatedAirQualityData | null {
	const cells = (record: AirQualityLADData) => record.gridCells;
	const no2Mean = weightedMean(records, (record) => record.no2Mean, cells);
	return no2Mean === null
		? null
		: {
				no2Mean,
				pm25Mean: weightedMean(
					records,
					(record) => record.pm25Mean,
					cells,
				),
				pm10Mean: weightedMean(
					records,
					(record) => record.pm10Mean,
					cells,
				),
			};
}
