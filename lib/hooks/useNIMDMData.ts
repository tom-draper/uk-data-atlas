import { NIMDMDataset, NIMDMLSOAData } from "@/lib/types/nimdm";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parseNumInt } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

const LGD_CODES: Record<string, string> = {
	"Antrim and Newtownabbey": "N09000001",
	"Armagh City, Banbridge and Craigavon": "N09000002",
	Belfast: "N09000003",
	"Causeway Coast and Glens": "N09000004",
	"Derry City and Strabane": "N09000005",
	"Fermanagh and Omagh": "N09000006",
	"Lisburn and Castlereagh": "N09000007",
	"Mid and East Antrim": "N09000008",
	"Mid Ulster": "N09000009",
	"Newry, Mourne and Down": "N09000010",
	"Ards and North Down": "N09000011",
};

const TOTAL_SOAS = 890;

function pick(row: Record<string, any>, ...keys: string[]): string {
	for (const k of keys) {
		const v = row[k];
		if (v !== undefined && v !== null && v !== "") return String(v).trim();
	}
	return "";
}

// Find a column whose key contains the given substring (handles newlines in headers)
function pickBySubstring(row: Record<string, any>, substring: string): string {
	for (const [k, v] of Object.entries(row)) {
		if (
			k.replace(/\s+/g, " ").includes(substring) &&
			v !== undefined &&
			v !== null &&
			v !== ""
		) {
			return String(v).trim();
		}
	}
	return "";
}

export const useNIMDMData = (enabled = true) => {
	return useDataLoader<NIMDMDataset>(async () => {
		const response = await fetch(
			withCDN("/data/deprivation/nimdm/NIMDM17_SOAresults.csv"),
		);
		if (!response.ok)
			throw new Error(
				`Failed to fetch NIMDM data: ${response.statusText}`,
			);

		const { data } = await parseCsv(await response.text(), {
			header: true,
		});

		const records: Record<string, NIMDMLSOAData> = {};
		for (const row of data as any[]) {
			const soaCode = pick(row, "SOA2001", "SOA2011", "SOA_Code", "SOA");
			if (!soaCode) continue;

			const lgdName = pick(
				row,
				"LGD2014NAME",
				"LGD2014",
				"LGD",
				"Council",
			);
			const lgdCode = LGD_CODES[lgdName] ?? "";

			const nimdmRank = parseNumInt(
				pickBySubstring(row, "Multiple Deprivation Measure Rank"),
			);
			if (!nimdmRank) continue;

			const nimdmDecile = Math.ceil((nimdmRank / TOTAL_SOAS) * 10);

			records[soaCode] = {
				soaCode,
				soaName: pick(row, "SOA2001_name", "SOA2011_name", "SOA Name"),
				lgdCode,
				lgdName,
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
					notes: [
						"Northern Ireland only. Decile 1 = most deprived 10% of Super Output Areas.",
					],
				},
			},
		};
	}, enabled);
};
