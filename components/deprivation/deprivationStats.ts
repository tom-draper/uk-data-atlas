import type { SelectedArea } from "@lib/types";

/**
 * What a deprivation card shows for the current selection.
 *
 * A single small area of the index's own geography has a published rank and
 * decile, so it is shown as one. Anything larger (the whole selection, a
 * local authority, or a ward, which rolls up to its local authority) is a
 * group, and is summarised: by its average score where the index publishes
 * scores, and otherwise by its share in the most deprived tenth, never by
 * averaging ranks or deciles.
 */
export type ResolvedDeprivation<TRecord, TSummary> =
	{ kind: "area"; record: TRecord } | { kind: "summary"; summary: TSummary };

export function resolveDeprivation<TRecord, TSummary>({
	aggregated,
	ladStats,
	selectedArea,
	fineArea,
}: {
	aggregated: TSummary | null;
	ladStats: Record<string, TSummary>;
	selectedArea: SelectedArea | null;
	fineArea: {
		type: SelectedArea["type"];
		records: Record<string, TRecord>;
	};
}): ResolvedDeprivation<TRecord, TSummary> | null {
	const summary = (value: TSummary | null | undefined) =>
		value ? { kind: "summary" as const, summary: value } : null;

	if (selectedArea === null) return summary(aggregated);

	if (selectedArea.type === "localAuthority")
		return summary(ladStats[selectedArea.code]);

	if (selectedArea.type === "ward" && selectedArea.data)
		return summary(ladStats[selectedArea.data.ladCode]);

	if (selectedArea.type === fineArea.type) {
		const record = fineArea.records[selectedArea.code];
		return record ? { kind: "area", record } : null;
	}

	return null;
}
