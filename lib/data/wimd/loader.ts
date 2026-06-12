import { WIMDDataset, WIMDLSOAData } from "@/lib/types/wimd";
import { findHeaderLine, parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum, parseNumInt } from "@/lib/helpers/parseNumber";

const LOCAL_AUTHORITY_CODES: Record<string, string> = {
	"Isle of Anglesey": "W06000001",
	Gwynedd: "W06000002",
	Conwy: "W06000003",
	Denbighshire: "W06000004",
	Flintshire: "W06000005",
	Wrexham: "W06000006",
	Ceredigion: "W06000008",
	Pembrokeshire: "W06000009",
	Carmarthenshire: "W06000010",
	Swansea: "W06000011",
	"Neath Port Talbot": "W06000012",
	Bridgend: "W06000013",
	"Vale of Glamorgan": "W06000014",
	Cardiff: "W06000015",
	"Rhondda Cynon Taf": "W06000016",
	Caerphilly: "W06000018",
	"Blaenau Gwent": "W06000019",
	Torfaen: "W06000020",
	Monmouthshire: "W06000021",
	Newport: "W06000022",
	Powys: "W06000023",
	"Merthyr Tydfil": "W06000024",
};

function pick(row: Record<string, any>, ...keys: string[]): string {
	for (const k of keys) {
		const v = row[k];
		if (v !== undefined && v !== null && v !== "") return String(v).trim();
	}
	return "";
}

export async function loadWIMD(
	read: (path: string) => Promise<string>,
): Promise<Record<string, WIMDDataset>> {
	const text = await read("deprivation/wimd/wimd2019.csv");
	const { data } = await parseCsv(text, {
		header: true,
		skipLines: findHeaderLine(text, "LSOA code"),
	});

	const records: Record<string, WIMDLSOAData> = {};
	for (const rawRow of data as any[]) {
		const row: Record<string, any> = {};
		for (const k of Object.keys(rawRow)) row[k.trim()] = rawRow[k];
		const lsoaCode = pick(row, "LSOA code", "LSOA Code", "lsoa_code", "LSOA_Code", "lsoaCode");
		if (!lsoaCode || !lsoaCode.startsWith("W")) continue;

		const ladName = pick(row, "Local Authority name", "Local Authority Name", "Local Authority", "la_name", "LA_Name");
		const ladCode = LOCAL_AUTHORITY_CODES[ladName] || "";

		const wimdScore = parseNum(pick(row, "WIMD 2019", "WIMD 2019 Score", "WIMD Score", "wimd_score", "Score"));
		const wimdRank = parseNumInt(pick(row, "WIMD 2019 Rank", "Overall WIMD 2019 Rank", "WIMD Rank", "wimd_rank", "Rank"));
		const wimdDecile = parseNumInt(pick(row, "WIMD 2019 Decile", "WIMD Decile", "wimd_decile", "Decile"));

		records[lsoaCode] = {
			lsoaCode,
			lsoaName: pick(row, "LSOA name", "LSOA Name", "lsoa_name", "LSOA_Name", "lsoaName"),
			ladCode,
			ladName,
			wimdScore,
			wimdRank,
			wimdDecile,
		};
	}

	const sorted = Object.values(records).sort((a, b) => b.wimdScore - a.wimdScore);
	sorted.forEach((record, i) => {
		record.wimdRank = i + 1;
		record.wimdDecile = Math.ceil(((i + 1) / sorted.length) * 10);
	});

	const ladGroups: Record<string, typeof records[string][]> = {};
	for (const r of Object.values(records)) {
		(ladGroups[r.ladCode] ??= []).push(r);
	}
	const ladStats: WIMDDataset["ladStats"] = {};
	for (const [lad, lsoas] of Object.entries(ladGroups)) {
		ladStats[lad] = {
			averageWIMDScore: lsoas.reduce((s, r) => s + r.wimdScore, 0) / lsoas.length,
			averageWIMDRank: lsoas.reduce((s, r) => s + r.wimdRank, 0) / lsoas.length,
			averageWIMDDecile: lsoas.reduce((s, r) => s + r.wimdDecile, 0) / lsoas.length,
		};
	}

	return {
		2019: {
			id: "wimd2019",
			year: 2019,
			type: "wimd",
			boundaryType: "lsoa",
			boundaryYear: 2011,
			data: records,
			ladStats,
			metadata: {
				source: "Welsh Government. Welsh Index of Multiple Deprivation 2019.",
				notes: ["Wales only. Decile 1 = most deprived 10% of LSOAs."],
			},
		},
	};
}
