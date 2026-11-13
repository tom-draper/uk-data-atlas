import type {
	AggregatedBroadbandData,
	BroadbandLADData,
} from "../../../types/broadband.ts";
import { weightedMean } from "../../../helpers/rates.ts";

/** Coverage is a share of premises, so authorities are weighted by premises. */
export function aggregateBroadband(
	records: BroadbandLADData[],
): AggregatedBroadbandData | null {
	const reporting = records.filter((record) => record.pctFullFibre != null);
	const share = (
		field: "pctSuperfast" | "pctUltrafast" | "pctFullFibre" | "pctGigabit",
	) =>
		weightedMean(
			reporting,
			(record) => record[field],
			(record) => record.premisesCount,
		) ?? 0;
	return reporting.some((record) => (record.premisesCount ?? 0) > 0)
		? {
				pctSuperfast: share("pctSuperfast"),
				pctUltrafast: share("pctUltrafast"),
				pctFullFibre: share("pctFullFibre"),
				pctGigabit: share("pctGigabit"),
			}
		: null;
}
