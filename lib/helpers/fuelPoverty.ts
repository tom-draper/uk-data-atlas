import { aggregateFuelPoverty } from "./datasetAggregation/numeric";
import type {
	AggregatedFuelPovertyData,
	FuelPovertyDataset,
} from "@/lib/types/fuelPoverty";

/**
 * Roll published LSOA estimates up to their local-authority parent. Rates are
 * household-weighted by pooling the published household counts, rather than
 * averaging LSOA percentages.
 */
export function aggregateFuelPovertyByLad(
	data: FuelPovertyDataset["data"],
	lsoaToLad: Record<string, string>,
): Record<string, AggregatedFuelPovertyData> {
	const recordsByLad: Record<string, FuelPovertyDataset["data"][string][]> =
		{};
	for (const [lsoaCode, record] of Object.entries(data)) {
		const ladCode = lsoaToLad[lsoaCode];
		if (ladCode) (recordsByLad[ladCode] ??= []).push(record);
	}

	const summaries: Record<string, AggregatedFuelPovertyData> = {};
	for (const [ladCode, records] of Object.entries(recordsByLad)) {
		const summary = aggregateFuelPoverty(records);
		if (summary) summaries[ladCode] = summary;
	}
	return summaries;
}
