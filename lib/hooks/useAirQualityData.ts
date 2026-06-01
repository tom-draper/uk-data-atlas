import { AirQualityDataset, AirQualityLADData } from "../types/airQuality";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parseNum, parseNullableNum } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

const YEAR = 2022;
const BOUNDARY_YEAR = 2024;

export const useAirQualityData = (enabled = true) => {
	return useDataLoader<AirQualityDataset>(async () => {
		const response = await fetch(
			withCDN("/data/environment/air-quality/no2-lad-2022.csv"),
		);
		if (!response.ok)
			throw new Error(
				`Failed to fetch air quality data: ${response.statusText}`,
			);

		const { data } = await parseCsv(await response.text(), { header: true });
		const rows = data as Record<string, string>[];

		const records: Record<string, AirQualityLADData> = {};

		for (const row of rows) {
			const ladCode = row["ladCode"]?.trim();
			if (!ladCode) continue;

			records[ladCode] = {
				ladCode,
				ladName: row["ladName"]?.trim() || "",
				no2Mean: parseNum(row["no2Mean"]),
				pm25Mean: parseNullableNum(row["pm25Mean"]),
				pm10Mean: parseNullableNum(row["pm10Mean"]),
			};
		}

		const dataset: AirQualityDataset = {
			id: `airQuality${YEAR}`,
			year: YEAR,
			type: "airQuality",
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		};

		return { [YEAR]: dataset };
	}, enabled);
};
