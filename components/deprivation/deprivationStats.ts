import type { SelectedArea } from "@lib/types";
import type { DeprivationSummary } from "@/lib/types/deprivation";

/**
 * What a deprivation card shows for the current selection.
 *
 * A single small area of the index's own geography has a published rank and
 * decile, so it is shown as one. Anything larger (the whole selection, a
 * local authority, or a ward, which rolls up to its local authority) is a
 * group, and is summarised rather than averaged.
 */
export type ResolvedDeprivation<TRecord> =
	| { kind: "area"; record: TRecord }
	| { kind: "summary"; summary: DeprivationSummary };

export function resolveDeprivation<TRecord>({
	aggregated,
	ladStats,
	selectedArea,
	fineArea,
}: {
	aggregated: DeprivationSummary | null;
	ladStats: Record<string, DeprivationSummary>;
	selectedArea: SelectedArea | null;
	fineArea: {
		type: SelectedArea["type"];
		records: Record<string, TRecord>;
	};
}): ResolvedDeprivation<TRecord> | null {
	const summary = (value: DeprivationSummary | null | undefined) =>
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
