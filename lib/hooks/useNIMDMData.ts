import { NIMDMDataset, NIMDMLSOAData } from "@/lib/types/nimdm";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parseNum, parseNumInt } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

const LGD_CODES: Record<string, string> = {
	"Antrim and Newtownabbey": "N09000001",
	"Armagh City, Banbridge and Craigavon": "N09000002",
	"Belfast": "N09000003",
	"Causeway Coast and Glens": "N09000004",
	"Derry City and Strabane": "N09000005",
	"Fermanagh and Omagh": "N09000006",
	"Lisburn and Castlereagh": "N09000007",
	"Mid and East Antrim": "N09000008",
	"Mid Ulster": "N09000009",
	"Newry, Mourne and Down": "N09000010",
	"Ards and North Down": "N09000011",
};

function pick(row: Record<string, any>, ...keys: string[]): string {
	for (const k of keys) {
		const v = row[k];
		if (v !== undefined && v !== null && v !== "") return String(v).trim();
	}
	return "";
}

export const useNIMDMData = () => {
	return useDataLoader<NIMDMDataset>(async () => {
		const response = await fetch(
			withCDN("/data/nimdm/nimdm2017.csv"),
		);
		if (!response.ok)
			throw new Error(`Failed to fetch NIMDM data: ${response.statusText}`);

		const { data } = await parseCsv(await response.text(), { header: true });

		const records: Record<string, NIMDMLSOAData> = {};
		for (const row of data as any[]) {
			const soaCode = pick(row, "SOA2011", "SOA Code", "SOA_Code", "soa_code", "SOA", "SuperOutputArea");
			if (!soaCode) continue;

			const lgdName = pick(row, "LGD2014", "LGD", "Local Government District", "lgd_name", "LGD_Name", "Council");
			const lgdCode = pick(row, "LGD2014_Code", "LGD Code", "lgd_code")
				|| LGD_CODES[lgdName]
				|| "";

			const nimdmRank = parseNumInt(pick(row, "MDM Rank", "NIMDM Rank", "Rank", "Overall MDM Rank", "MDM_Rank", "nimdm_rank"));
			const nimdmScore = parseNum(pick(row, "MDM Score", "NIMDM Score", "Score", "Overall MDM Score", "MDM_Score", "nimdm_score"));
			const nimdmDecile = parseNumInt(pick(row, "MDM Decile", "NIMDM Decile", "Decile", "MDM_Decile", "nimdm_decile"));

			records[soaCode] = {
				soaCode,
				soaName: pick(row, "SOA2011 Name", "SOA Name", "SOA_Name", "soa_name", "Name"),
				lgdCode,
				lgdName,
				nimdmScore,
				nimdmRank,
				nimdmDecile,
			};
		}

		return {
			2017: {
				id: "nimdm2017",
				year: 2017,
				type: "nimdm",
				boundaryType: "superOutputArea",
				boundaryYear: 2011,
				data: records,
				metadata: {
					source: "Northern Ireland Statistics and Research Agency. Northern Ireland Multiple Deprivation Measure 2017.",
					notes: ["Northern Ireland only. Decile 1 = most deprived 10% of Super Output Areas."],
				},
			},
		};
	});
};
