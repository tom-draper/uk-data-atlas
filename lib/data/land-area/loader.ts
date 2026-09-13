import type { LandAreaDataset, LandAreaLADData } from "@/lib/types/landArea";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum } from "@/lib/helpers/parseNumber";

const YEAR = 2024;
const BOUNDARY_YEAR = 2024;
const HECTARES_PER_SQUARE_KM = 100;

export async function loadLandArea(
	read: (path: string) => Promise<string>,
): Promise<Record<string, LandAreaDataset>> {
	const { data } = await parseCsv(
		await read("geography/land-area/sam-lad-2024-12.csv"),
		{ header: true },
	);

	const records: Record<string, LandAreaLADData> = {};
	for (const row of data as Record<string, string>[]) {
		const ladCode = row["ladCode"]?.trim();
		if (!ladCode) continue;

		const landHectares = parseNum(row["landHectares"]);
		records[ladCode] = {
			ladCode,
			ladName: row["ladName"]?.trim() || "",
			landHectares,
			landSquareKm: landHectares / HECTARES_PER_SQUARE_KM,
			extentHectares: parseNum(row["extentHectares"]),
			inlandWaterHectares: parseNum(row["inlandWaterHectares"]),
		};
	}

	return {
		[YEAR]: {
			id: `landArea${YEAR}`,
			type: "landArea",
			year: YEAR,
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		},
	};
}
