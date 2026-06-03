import { SIMDDataset, SIMDDataZoneData } from "@/lib/types/simd";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNum, parsePct } from "@/lib/helpers/parseNumber";

const COUNCIL_AREA_CODES: Record<string, string> = {
	"Aberdeen City": "S12000033",
	Aberdeenshire: "S12000034",
	Angus: "S12000041",
	"Argyll and Bute": "S12000035",
	"City of Edinburgh": "S12000036",
	Clackmannanshire: "S12000005",
	"Dumfries and Galloway": "S12000006",
	"Dundee City": "S12000042",
	"East Ayrshire": "S12000008",
	"East Dunbartonshire": "S12000045",
	"East Lothian": "S12000010",
	"East Renfrewshire": "S12000011",
	Falkirk: "S12000014",
	Fife: "S12000015",
	"Glasgow City": "S12000046",
	Highland: "S12000017",
	Inverclyde: "S12000018",
	Midlothian: "S12000019",
	Moray: "S12000020",
	"Na h-Eileanan Siar": "S12000013",
	"North Ayrshire": "S12000021",
	"North Lanarkshire": "S12000044",
	"Orkney Islands": "S12000023",
	"Perth and Kinross": "S12000024",
	Renfrewshire: "S12000038",
	"Scottish Borders": "S12000026",
	"Shetland Islands": "S12000027",
	"South Ayrshire": "S12000028",
	"South Lanarkshire": "S12000029",
	Stirling: "S12000030",
	"West Dunbartonshire": "S12000039",
	"West Lothian": "S12000040",
};

export async function loadSIMD(
	read: (path: string) => Promise<string>,
): Promise<Record<string, SIMDDataset>> {
	const { data } = await parseCsv(
		await read("deprivation/simd/SIMD+2020v2+-+indicators.csv"),
		{ header: true },
	);

	const rows = data as any[];
	const hasRanks =
		rows[0] &&
		(rows[0]["SIMD2020v2_Rank"] !== undefined || rows[0]["SIMD2020_Rank"] !== undefined);

	type Intermediate = {
		dzCode: string; dzName: string; councilAreaCode: string; councilAreaName: string;
		score: number; simdRank: number; simdQuintile: number; simdDecile: number;
	};

	const intermediates: Intermediate[] = [];

	for (const row of rows) {
		const dzCode = row["Data_Zone"]?.trim();
		if (!dzCode || !dzCode.startsWith("S")) continue;

		const councilAreaName = row["Council_area"]?.trim() || row["Council_Area"]?.trim() || "";
		const councilAreaCode = COUNCIL_AREA_CODES[councilAreaName] || "";

		let simdRank = 0, simdQuintile = 0, simdDecile = 0, score = 0;

		if (hasRanks) {
			simdRank = parseInt(row["SIMD2020v2_Rank"] ?? row["SIMD2020_Rank"]) || 0;
			simdQuintile = parseInt(row["SIMD2020v2_Quintile"] ?? row["SIMD2020_Quintile"]) || 0;
			simdDecile = parseInt(row["SIMD2020v2_Decile"] ?? row["SIMD2020_Decile"]) || 0;
		} else {
			const income = parsePct(row["Income_rate"]);
			const employment = parsePct(row["Employment_rate"]);
			const health = parseNum(row["CIF"]);
			const crime = parseNum(row["crime_rate"]);
			const housing = parsePct(row["overcrowded_rate"]) + parsePct(row["nocentralheat_rate"]);
			score = income * 0.28 + employment * 0.28 + health * 0.14 + crime * 0.005 + housing * 0.02;
		}

		intermediates.push({ dzCode, dzName: row["Intermediate_Zone"]?.trim() || "", councilAreaCode, councilAreaName, score, simdRank, simdQuintile, simdDecile });
	}

	if (!hasRanks && intermediates.length > 0) {
		intermediates.sort((a, b) => b.score - a.score);
		const total = intermediates.length;
		intermediates.forEach((dz, i) => {
			dz.simdRank = i + 1;
			dz.simdQuintile = Math.min(5, Math.ceil(((i + 1) / total) * 5));
			dz.simdDecile = Math.min(10, Math.ceil(((i + 1) / total) * 10));
		});
	}

	const records: Record<string, SIMDDataZoneData> = {};
	for (const dz of intermediates) {
		records[dz.dzCode] = {
			dzCode: dz.dzCode, dzName: dz.dzName,
			councilAreaCode: dz.councilAreaCode, councilAreaName: dz.councilAreaName,
			simdRank: dz.simdRank, simdQuintile: dz.simdQuintile, simdDecile: dz.simdDecile,
		};
	}

	const councilGroups: Record<string, typeof records[string][]> = {};
	for (const r of Object.values(records)) {
		(councilGroups[r.councilAreaCode] ??= []).push(r);
	}
	const councilStats: SIMDDataset["councilStats"] = {};
	for (const [code, dzs] of Object.entries(councilGroups)) {
		councilStats[code] = {
			averageSIMDRank: dzs.reduce((s, r) => s + r.simdRank, 0) / dzs.length,
			averageSIMDQuintile: dzs.reduce((s, r) => s + r.simdQuintile, 0) / dzs.length,
		};
	}

	return {
		2020: {
			id: "simd2020",
			year: 2020,
			type: "simd",
			boundaryType: "dataZone",
			boundaryYear: 2011,
			data: records,
			councilStats,
			metadata: {
				source: "Scottish Government. Scottish Index of Multiple Deprivation 2020v2.",
				notes: ["Scotland only. Quintile 1 = most deprived 20% of data zones."],
			},
		},
	};
}
