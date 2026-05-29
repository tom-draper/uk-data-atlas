import { IMDDataset, IMDLSOAData } from "@/lib/types/imd";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parseNum, parseNumInt } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

export const useIMDData = () => {
	return useDataLoader<IMDDataset>(async () => {
		const response = await fetch(
			withCDN(
				"/data/deprivation/imd/File_7_-_All_IoD2019_Scores__Ranks__Deciles_and_Population_Denominators_3.csv",
			),
		);
		if (!response.ok)
			throw new Error(`Failed to fetch IMD data: ${response.statusText}`);

		const { data } = await parseCsv(await response.text(), {
			header: true,
		});

		const records: Record<string, IMDLSOAData> = {};
		for (const row of data as any[]) {
			const lsoaCode = row["LSOA code (2011)"]?.trim();
			if (!lsoaCode || !lsoaCode.startsWith("E")) continue;

			records[lsoaCode] = {
				lsoaCode,
				lsoaName: row["LSOA name (2011)"]?.trim() || "",
				ladCode:
					row["Local Authority District code (2019)"]?.trim() || "",
				ladName:
					row["Local Authority District name (2019)"]?.trim() || "",
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
				livingEnvironmentScore: parseNum(
					row["Living Environment Score"],
				),
			};
		}

		return {
			2019: {
				id: "imd2019",
				year: 2019,
				type: "imd",
				boundaryType: "lsoa",
				boundaryYear: 2011,
				data: records,
				metadata: {
					source: "Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019.",
					notes: [
						"England only. Decile 1 = most deprived 10% of LSOAs.",
					],
				},
			},
		};
	});
};
