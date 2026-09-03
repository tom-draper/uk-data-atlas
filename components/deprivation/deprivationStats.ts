import type { SelectedArea } from "@lib/types";

/**
 * Which stats a deprivation index shows for the selected area. Every index
 * publishes the same shape of lookup: the whole selection when nothing is
 * picked, a local-authority rollup for a LAD or one of its wards, and its own
 * finest geography read straight from the source records.
 */
export function resolveDeprivationStats<TStats, TRecord>({
	aggregated,
	ladStats,
	selectedArea,
	fineArea,
}: {
	aggregated: TStats | null;
	ladStats: Record<string, TStats>;
	selectedArea: SelectedArea | null;
	fineArea: {
		type: SelectedArea["type"];
		records: Record<string, TRecord>;
		statsFor: (record: TRecord) => TStats;
	};
}): TStats | null {
	if (selectedArea === null) return aggregated;

	if (selectedArea.type === "localAuthority")
		return ladStats[selectedArea.code] ?? null;

	if (selectedArea.type === "ward" && selectedArea.data)
		return ladStats[selectedArea.data.ladCode] ?? null;

	if (selectedArea.type === fineArea.type) {
		const record = fineArea.records[selectedArea.code];
		return record ? fineArea.statsFor(record) : null;
	}

	return null;
}
