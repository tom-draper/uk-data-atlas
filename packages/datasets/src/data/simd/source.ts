import { parseCsv } from "../../helpers/parseCsv.ts";

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
