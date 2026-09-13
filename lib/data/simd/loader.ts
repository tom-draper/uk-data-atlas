import { SIMDDataset, SIMDDataZoneData } from "@/lib/types/simd";
import {
	isMostDeprivedSIMD,
	summariseDeprivationBy,
} from "@/lib/helpers/datasetAggregation/deprivation";
import { parseCsv } from "@/lib/helpers/parseCsv";

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

/**
 * The published rank, decile and quintile, keyed by data zone code.
 *
 * These come from the Scottish Government's data zone lookup. The indicators
 * file carries no rank, and the index is not a weighted sum of indicators, so
 * nothing here is computed.
 */
export async function publishedSIMDRanks(
	lookupCsv: string,
): Promise<Map<string, { rank: number; decile: number; quintile: number }>> {
	const { data } = await parseCsv(lookupCsv, { header: true });
	const ranks = new Map<
		string,
		{ rank: number; decile: number; quintile: number }
	>();
	for (const row of data) {
		const dzCode = row["DZ"]?.trim();
		if (!dzCode?.startsWith("S01")) continue;
		const rank = Number(row["SIMD2020v2_Rank"]);
		const decile = Number(row["SIMD2020v2_Decile"]);
		const quintile = Number(row["SIMD2020v2_Quintile"]);
		if (![rank, decile, quintile].every(Number.isInteger))
			throw new Error(`SIMD lookup: unreadable rank for ${dzCode}`);
		ranks.set(dzCode, { rank, decile, quintile });
	}
	return ranks;
}

export async function loadSIMD(
	read: (path: string) => Promise<string>,
	lookupCsv: string,
): Promise<Record<string, SIMDDataset>> {
	const { data } = await parseCsv(
		await read("deprivation/simd/SIMD+2020v2+-+indicators.csv"),
		{ header: true },
	);
	const published = await publishedSIMDRanks(lookupCsv);

	const records: Record<string, SIMDDataZoneData> = {};
	for (const row of data) {
		const dzCode = row["Data_Zone"]?.trim();
		if (!dzCode || !dzCode.startsWith("S")) continue;
		const ranks = published.get(dzCode);
		if (!ranks)
			throw new Error(`SIMD lookup: no published rank for ${dzCode}`);

		const councilAreaName =
			row["Council_area"]?.trim() || row["Council_Area"]?.trim() || "";
		records[dzCode] = {
			dzCode,
			dzName: row["Intermediate_Zone"]?.trim() || "",
			councilAreaCode: COUNCIL_AREA_CODES[councilAreaName] || "",
			councilAreaName,
			simdRank: ranks.rank,
			simdQuintile: ranks.quintile,
			simdDecile: ranks.decile,
		};
	}

	const councilStats: SIMDDataset["councilStats"] = summariseDeprivationBy(
		Object.values(records),
		(record) => record.councilAreaCode,
		isMostDeprivedSIMD,
	);

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
				notes: [
					"Scotland only. Quintile 1 = most deprived 20% of data zones.",
				],
			},
		},
	};
}
