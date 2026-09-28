import { IMDDataset, IMDLSOAData } from "@/lib/types/imd";
import {
	summariseDeprivationBy,
	summariseIMD,
} from "@/lib/helpers/datasetAggregation/deprivation";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum, parseNumInt } from "@/lib/helpers/parseNumber";

export async function loadIMD(
	read: (path: string) => Promise<string>,
): Promise<Record<string, IMDDataset>> {
	const text = await read(
		"deprivation/imd/File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv",
	);
	const { data } = await parseCsv(text, { header: true });

	const records: Record<string, IMDLSOAData> = {};
	for (const row of data) {
		const lsoaCode = row["LSOA code (2021)"]?.trim();
		if (!lsoaCode || !lsoaCode.startsWith("E")) continue;

		records[lsoaCode] = {
			lsoaCode,
			lsoaName: row["LSOA name (2021)"]?.trim() || "",
			ladCode: row["Local Authority District code (2024)"]?.trim() || "",
			ladName: row["Local Authority District name (2024)"]?.trim() || "",
			imdScore: parseNum(
				row["Index of Multiple Deprivation (IMD) Score"],
			),
			imdRank: parseNumInt(
				row[
					"Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)"
				],
			),
			imdDecile: parseNumInt(
				row[
					"Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)"
				],
			),
			incomeScore: parseNum(row["Income Score (rate)"]),
			employmentScore: parseNum(row["Employment Score (rate)"]),
			educationScore: parseNum(
				row["Education, Skills and Training Score"],
			),
			healthScore: parseNum(
				row["Health Deprivation and Disability Score"],
			),
			crimeScore: parseNum(row["Crime Score"]),
			housingScore: parseNum(
				row["Barriers to Housing and Services Score"],
			),
			livingEnvironmentScore: parseNum(row["Living Environment Score"]),
			population: parseNumInt(row["Total population: mid 2022"]),
		};
	}

	const ladStats: IMDDataset["ladStats"] = summariseDeprivationBy(
		Object.values(records),
		(record) => record.ladCode,
		summariseIMD,
	);

	return {
		2025: {
			id: "imd2025",
			year: 2025,
			type: "imd",
			boundaryType: "lsoa",
			boundaryYear: 2021,
			data: records,
			ladStats,
			metadata: {
				source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2025.",
				notes: ["England only. Decile 1 = most deprived 10% of LSOAs."],
			},
		},
	};
}
