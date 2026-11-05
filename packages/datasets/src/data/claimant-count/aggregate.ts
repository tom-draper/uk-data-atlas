import type {
	AggregatedClaimantCountData,
	ClaimantCountLADData,
} from "../../types/claimantCount.ts";
import { denominator } from "../../helpers/rates.ts";

/**
 * Counts add. Both rates are claimants as a share of residents aged 16 to 64,
 * so the combined rate is the summed claimants over the summed residents,
 * recovered from each authority's count and rate.
 */
export function aggregateClaimantCount(
	records: ClaimantCountLADData[],
): AggregatedClaimantCountData | null {
	if (records.length === 0) return null;
	let totalCount = 0,
		youthCount = 0,
		residents = 0,
		ratedTotal = 0,
		ratedYouth = 0;
	for (const record of records) {
		totalCount += record.totalCount;
		youthCount += record.youthCount;
		const population = denominator(
			record.totalCount,
			100,
			record.totalRate,
		);
		if (population === null) continue;
		residents += population;
		ratedTotal += record.totalCount;
		ratedYouth += record.youthCount;
	}
	return {
		totalCount,
		totalRate: residents > 0 ? (ratedTotal / residents) * 100 : 0,
		youthCount,
		youthRate: residents > 0 ? (ratedYouth / residents) * 100 : 0,
	};
}
