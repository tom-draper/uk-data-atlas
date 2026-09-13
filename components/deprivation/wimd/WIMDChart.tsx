"use client";
import {
	ActiveViz,
	AggregatedWIMDData,
	Dataset,
	WIMDDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivation } from "../deprivationStats";

const WIMD: DeprivationIndex = {
	datasetType: "wimd",
	label: "WIMD",
	region: "Wales",
	attribution:
		"Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales",
	metric: "score",
	metricMaximum: 86.6,
	areaNoun: "LSOAs",
};

interface WIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, WIMDDataset>;
	aggregatedData: Record<number, AggregatedWIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function WIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: WIMDChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const resolved = resolveDeprivation({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.ladStats,
		selectedArea,
		fineArea: { type: "lsoa", records: dataset.data },
	});

	return (
		<DeprivationChart
			index={WIMD}
			dataset={dataset}
			activeDataset={activeDataset}
			view={
				resolved === null
					? null
					: resolved.kind === "summary"
						? resolved
						: {
								kind: "area",
								decile: resolved.record.wimdDecile,
								detail: {
									kind: "score",
									value: resolved.record.wimdScore,
								},
							}
			}
			setActiveViz={setActiveViz}
		/>
	);
}
