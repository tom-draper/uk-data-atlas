import { WIMDDataset, WIMDLSOAData } from "@/lib/types/wimd";
import {
	isMostDeprivedWIMD,
	summariseDeprivationBy,
} from "@/lib/helpers/datasetAggregation/deprivation";
import { findHeaderLine, parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum } from "@/lib/helpers/parseNumber";
import { odsTableRows } from "@/lib/data/spreadsheet/ods";

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

/**
 * The published overall rank and decile, keyed by LSOA code.
 *
 * These come from the Welsh Government's ranks workbook, not from sorting the
 * scores: the scores sheet rounds to one decimal place, and re-ranking it
 * disagrees with the published rank for most LSOAs.
 */
export function publishedWIMDRanks(
	ranksContentXml: string,
): Map<string, { rank: number; decile: number }> {
	const ranks = new Map<string, { rank: number; decile: number }>();
	for (const row of odsTableRows(ranksContentXml, {
		table: "Deciles_quintiles_quartiles",
		label: "wimd ranks",
		maxColumns: 8,
	})) {
		const [lsoaCode, , , rank, decile] = row;
		if (!lsoaCode?.startsWith("W01")) continue;
		const parsedRank = Number(rank);
		const parsedDecile = Number(decile);
		if (!Number.isInteger(parsedRank) || !Number.isInteger(parsedDecile))
			throw new Error(
				`WIMD ranks: unreadable rank or decile for ${lsoaCode}`,
			);
		ranks.set(lsoaCode, { rank: parsedRank, decile: parsedDecile });
	}
	return ranks;
}

export async function loadWIMD(
	read: (path: string) => Promise<string>,
	ranksContentXml: string,
): Promise<Record<string, WIMDDataset>> {
	const published = publishedWIMDRanks(ranksContentXml);
	const text = await read("deprivation/wimd/wimd2019.csv");
	const { data } = await parseCsv(text, {
		header: true,
		skipLines: findHeaderLine(text, "LSOA code"),
	});

	const records: Record<string, WIMDLSOAData> = {};
	for (const rawRow of data) {
		const row: Record<string, any> = {};
		for (const k of Object.keys(rawRow)) row[k.trim()] = rawRow[k];
		const lsoaCode = pick(
			row,
			"LSOA code",
			"LSOA Code",
			"lsoa_code",
			"LSOA_Code",
			"lsoaCode",
		);
		if (!lsoaCode || !lsoaCode.startsWith("W")) continue;

		const ladName = pick(
			row,
			"Local Authority name",
			"Local Authority Name",
			"Local Authority",
			"la_name",
			"LA_Name",
		);
		const ladCode = LOCAL_AUTHORITY_CODES[ladName] || "";

		const wimdScore = parseNum(
			pick(
				row,
				"WIMD 2019",
				"WIMD 2019 Score",
				"WIMD Score",
				"wimd_score",
				"Score",
			),
		);
		const publishedRank = published.get(lsoaCode);
		if (!publishedRank)
			throw new Error(`WIMD ranks: no published rank for ${lsoaCode}`);
		const wimdRank = publishedRank.rank;
		const wimdDecile = publishedRank.decile;

		records[lsoaCode] = {
			lsoaCode,
			lsoaName: pick(
				row,
				"LSOA name",
				"LSOA Name",
				"lsoa_name",
				"LSOA_Name",
				"lsoaName",
			),
			ladCode,
			ladName,
			wimdScore,
			wimdRank,
			wimdDecile,
		};
	}

	const ladStats: WIMDDataset["ladStats"] = summariseDeprivationBy(
		Object.values(records),
		(record) => record.ladCode,
		isMostDeprivedWIMD,
	);

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
