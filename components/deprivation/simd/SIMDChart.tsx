"use client";
import {
	ActiveViz,
	AggregatedSIMDData,
	Dataset,
	SIMDDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivation } from "../deprivationStats";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";

const SIMD: DeprivationIndex = {
	datasetType: "simd",
	label: "SIMD",
	region: "Scotland",
	attribution:
		"Scottish Government. Scottish Index of Multiple Deprivation 2020v2. gov.scot",
	metric: "rank",
	metricMaximum: 6976,
	areaNoun: "data zones",
};

interface SIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SIMDDataset>;
	aggregatedData: Record<number, AggregatedSIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

export default function SIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: SIMDChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const resolved = resolveDeprivation({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.councilStats,
		selectedArea,
		fineArea: { type: "dataZone", records: dataset.data },
		codeMapper,
	});

	return (
		<DeprivationChart
			index={SIMD}
			dataset={dataset}
			activeDataset={activeDataset}
			view={
				resolved === null
					? null
					: resolved.kind === "summary"
						? resolved
						: {
								kind: "area",
								decile: resolved.record.simdDecile,
								detail: {
									kind: "rank",
									value: resolved.record.simdRank,
								},
							}
			}
			setActiveViz={setActiveViz}
		/>
	);
}
