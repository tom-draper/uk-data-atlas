import { odsTableRows } from "../spreadsheet/ods.ts";

export const LOCAL_AUTHORITY_CODES: Record<string, string> = {
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

export function pick(row: Record<string, any>, ...keys: string[]): string {
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

/**
 * ONS mid-2017 population by LSOA code, from the Nomis extract beside the
 * scores. WIMD publishes no population of its own, and a group's average score
 * is weighted by it.
 */
export function welshLSOAPopulations(csv: string): Map<string, number> {
	const populations = new Map<string, number>();
	for (const line of csv.split(/\r?\n/).slice(1)) {
		if (!line.trim()) continue;
		const cells = line.split(",").map((cell) => cell.replace(/"/g, ""));
		const code = cells[1];
		const population = Number(cells.at(-1));
		if (!code?.startsWith("W01") || !Number.isInteger(population))
			throw new Error(`WIMD population: unreadable row "${line}"`);
		populations.set(code, population);
	}
	return populations;
}
