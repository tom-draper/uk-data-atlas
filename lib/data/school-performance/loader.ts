import {
	SchoolPerformanceDataset,
	SchoolPerformanceLADData,
} from "@/lib/types/schoolPerformance";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

export async function loadSchoolPerformance(
	read: (path: string) => Promise<string>,
): Promise<Record<string, SchoolPerformanceDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read("education/ks4-performance/ks4-lad-2024.csv"),
		{ header: true },
	);

	const records: Record<string, SchoolPerformanceLADData> = {};

	for (const row of data as Record<string, string>[]) {
		if (row["geographic_level"] !== "Local authority district") continue;

		const code = (row["lad_code"] ?? "").trim();
		const name = (row["lad_name"] ?? "").trim();
		if (!code || !/^E[0-9]/.test(code)) continue;

		records[code] = {
			ladCode: code,
			ladName: name,
			ptL2basics94: parseNullableNum(row["pt_l2basics_94"]),
			ptL2basics95: parseNullableNum(row["pt_l2basics_95"]),
			avgAtt8: parseNullableNum(row["avg_att8"]),
			avgP8score: parseNullableNum(row["avg_p8score"]),
			pupils: parseNullableNum(row["t_pupils"]),
		};
	}

	return {
		2024: {
			id: "schoolPerformance2024",
			type: "schoolPerformance",
			year: 2024,
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			data: records,
		},
	};
}
