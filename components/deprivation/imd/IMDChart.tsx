"use client";
import {
	ActiveViz,
	AggregatedIMDData,
	Dataset,
	IMDDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivationStats } from "../deprivationStats";

const IMD: DeprivationIndex = {
	datasetType: "imd",
	label: "IMD",
	region: "England",
	attribution:
		"Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk",
};

interface IMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IMDDataset>;
	aggregatedData: Record<number, AggregatedIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function IMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: IMDChartProps) {
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
				averageIMDScore: record.imdScore,
				averageIMDDecile: record.imdDecile,
			}),
		},
	});

	return (
		<DeprivationChart
			index={IMD}
			dataset={dataset}
			activeDataset={activeDataset}
			selectedArea={selectedArea}
			decile={stats?.averageIMDDecile ?? null}
			detail={
				stats ? { kind: "score", value: stats.averageIMDScore } : null
			}
			setActiveViz={setActiveViz}
		/>
	);
}
