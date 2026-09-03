"use client";
import {
	ActiveViz,
	AggregatedSIMDData,
	Dataset,
	SIMDDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivationStats } from "../deprivationStats";

const SIMD: DeprivationIndex = {
	datasetType: "simd",
	label: "SIMD",
	region: "Scotland",
	attribution:
		"Scottish Government. Scottish Index of Multiple Deprivation 2020v2. gov.scot",
};

interface SIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SIMDDataset>;
	aggregatedData: Record<number, AggregatedSIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function SIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: SIMDChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const stats = resolveDeprivationStats({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.councilStats,
		selectedArea,
		fineArea: {
			type: "dataZone",
			records: dataset.data,
			statsFor: (record) => ({
				averageSIMDRank: record.simdRank,
				averageSIMDQuintile: record.simdQuintile,
				averageSIMDDecile: record.simdDecile,
			}),
		},
	});

	return (
		<DeprivationChart
			index={SIMD}
			dataset={dataset}
			activeDataset={activeDataset}
			selectedArea={selectedArea}
			decile={stats?.averageSIMDDecile ?? null}
			detail={
				stats ? { kind: "rank", value: stats.averageSIMDRank } : null
			}
			setActiveViz={setActiveViz}
			extraClassName="block w-full text-left"
		/>
	);
}
