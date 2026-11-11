import type {
	AggregatedRegionalGdpData,
	RegionalGdpAreaData,
} from "../../types/regionalGdp.ts";

/** GDP and GVA are monetary totals, so they add across ITL areas. */
export function aggregateRegionalGdp(
	records: RegionalGdpAreaData[],
): AggregatedRegionalGdpData | null {
	if (records.length === 0) return null;
	return records.reduce<AggregatedRegionalGdpData>(
		(total, record) => ({
			gvaMillionGbp: total.gvaMillionGbp + record.gvaMillionGbp,
			gdpMillionGbp: total.gdpMillionGbp + record.gdpMillionGbp,
		}),
		{ gvaMillionGbp: 0, gdpMillionGbp: 0 },
	);
}
