"use client";
import {
	ActiveViz,
	AggregatedWIMDData,
	Dataset,
	WIMDDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivationStats } from "../deprivationStats";

const WIMD: DeprivationIndex = {
	datasetType: "wimd",
	label: "WIMD",
	region: "Wales",
	attribution:
		"Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales",
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

	const stats = resolveDeprivationStats({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.ladStats,
		selectedArea,
		fineArea: {
			type: "lsoa",
			records: dataset.data,
			statsFor: (record) => ({
				averageWIMDScore: record.wimdScore,
				averageWIMDRank: record.wimdRank,
				averageWIMDDecile: record.wimdDecile,
			}),
		},
	});

	return (
		<DeprivationChart
			index={WIMD}
			dataset={dataset}
			activeDataset={activeDataset}
			selectedArea={selectedArea}
			decile={stats?.averageWIMDDecile ?? null}
			detail={
				stats ? { kind: "rank", value: stats.averageWIMDRank } : null
			}
			setActiveViz={setActiveViz}
			extraClassName="block w-full text-left"
		/>
	);
}
