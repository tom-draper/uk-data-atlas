import { SIMDDataset, SIMDDataZoneData } from "../../types/simd";
import {
	isMostDeprivedSIMD,
	summariseDeprivation,
	summariseDeprivationBy,
} from "../../helpers/datasetAggregation/deprivation";
import { parseCsv } from "../../helpers/parseCsv";

type PublishedRanks = {
	rank: number;
	decile: number;
	quintile: number;
	councilAreaCode: string;
};

/**
 * The published rank, decile and quintile, and the data zone's council area
 * code, keyed by data zone code.
 *
 * These come from the Scottish Government's data zone lookup. The indicators
 * file carries no rank, and the index is not a weighted sum of indicators, so
 * nothing here is computed.
 */
export async function publishedSIMDRanks(
	lookupCsv: string,
): Promise<Map<string, PublishedRanks>> {
	const { data } = await parseCsv(lookupCsv, { header: true });
	const ranks = new Map<string, PublishedRanks>();
	for (const row of data) {
		const dzCode = row["DZ"]?.trim();
		if (!dzCode?.startsWith("S01")) continue;
		const rank = Number(row["SIMD2020v2_Rank"]);
		const decile = Number(row["SIMD2020v2_Decile"]);
		const quintile = Number(row["SIMD2020v2_Quintile"]);
		if (![rank, decile, quintile].every(Number.isInteger))
			throw new Error(`SIMD lookup: unreadable rank for ${dzCode}`);
		const councilAreaCode = row["LAcode"]?.trim() ?? "";
		if (!councilAreaCode.startsWith("S12"))
			throw new Error(`SIMD lookup: no council area code for ${dzCode}`);
		ranks.set(dzCode, { rank, decile, quintile, councilAreaCode });
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

		records[dzCode] = {
			dzCode,
			dzName: row["Intermediate_Zone"]?.trim() || "",
			councilAreaCode: ranks.councilAreaCode,
			councilAreaName:
				row["Council_area"]?.trim() ||
				row["Council_Area"]?.trim() ||
				"",
			simdRank: ranks.rank,
			simdQuintile: ranks.quintile,
			simdDecile: ranks.decile,
		};
	}

	const councilStats: SIMDDataset["councilStats"] = summariseDeprivationBy(
		Object.values(records),
		(record) => record.councilAreaCode,
		(group) => summariseDeprivation(group, isMostDeprivedSIMD),
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
