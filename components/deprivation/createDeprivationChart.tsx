"use client";
import type { ActiveViz, Dataset, SelectedArea } from "@lib/types";
import type {
	DeprivationSummary,
	ScoredDeprivationSummary,
} from "@/lib/types/deprivation";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";
import {
	DeprivationChart,
	type DeprivationDetail,
	type DeprivationIndex,
} from "./DeprivationChart";
import { resolveDeprivation } from "./deprivationStats";

type DeprivationSummaryOf = DeprivationSummary | ScoredDeprivationSummary;

type DeprivationDatasetShape<TRecord> = {
	id: string;
	type: Dataset["type"];
	year: number;
	data: Record<string, TRecord>;
};

export interface DeprivationChartProps<
	TDataset,
	TSummary extends DeprivationSummaryOf,
> {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, TDataset>;
	aggregatedData: Record<number, TSummary> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

/** What one national index adds to the shared card. */
interface DeprivationChartConfig<
	TDataset extends DeprivationDatasetShape<TRecord>,
	TRecord,
	TSummary extends DeprivationSummaryOf,
> {
	index: DeprivationIndex;
	/** The index's own small-area geography, as a selected area's type. */
	fineAreaType: SelectedArea["type"];
	/** Each local authority's summary, under whatever the dataset calls them. */
	authorityStats(dataset: TDataset): Record<string, TSummary>;
	/** The decile and detail line for one published small area. */
	areaView(record: TRecord): {
		decile: number | null;
		detail: DeprivationDetail | null;
	};
}

/**
 * The chart card for one national deprivation index. The four indices differ
 * only in their wording and in the names they publish their fields under, so
 * each chart file states those and leaves the selection logic here.
 */
export function createDeprivationChart<
	TDataset extends DeprivationDatasetShape<TRecord>,
	TRecord,
	TSummary extends DeprivationSummaryOf,
>({
	index,
	fineAreaType,
	authorityStats,
	areaView,
}: DeprivationChartConfig<TDataset, TRecord, TSummary>) {
	return function NationalDeprivationChart({
		activeDataset,
		availableDatasets,
		aggregatedData,
		selectedArea,
		year,
		codeMapper,
		setActiveViz,
	}: DeprivationChartProps<TDataset, TSummary>) {
		const dataset = availableDatasets?.[year];
		if (!dataset) return null;

		const resolved = resolveDeprivation<TRecord, TSummary>({
			aggregated: aggregatedData?.[dataset.year] ?? null,
			ladStats: authorityStats(dataset),
			selectedArea,
			fineArea: { type: fineAreaType, records: dataset.data },
			codeMapper,
		});

		return (
			<DeprivationChart
				index={index}
				dataset={dataset}
				activeDataset={activeDataset}
				view={
					resolved === null
						? null
						: resolved.kind === "summary"
							? resolved
							: { kind: "area", ...areaView(resolved.record) }
				}
				setActiveViz={setActiveViz}
			/>
		);
	};
}
