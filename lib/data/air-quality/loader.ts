import { AirQualityDataset, AirQualityLADData } from "@/lib/types/airQuality";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum, parseNullableNum } from "@/lib/helpers/parseNumber";

const YEAR = 2022;
const BOUNDARY_YEAR = 2024;

export async function loadAirQuality(
	read: (path: string) => Promise<string>,
): Promise<Record<string, AirQualityDataset>> {
	const { data } = await parseCsv(
		await read("environment/air-quality/no2-lad-2022.csv"),
		{ header: true },
	);

	const records: Record<string, AirQualityLADData> = {};
	for (const row of data as Record<string, string>[]) {
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

	return {
		[YEAR]: {
			id: `airQuality${YEAR}`,
			year: YEAR,
			type: "airQuality",
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		},
	};
}
