"use client";
import {
	ActiveViz,
	AggregatedNIMDMData,
	Dataset,
	NIMDMDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivationStats } from "../deprivationStats";

const NIMDM: DeprivationIndex = {
	datasetType: "nimdm",
	label: "NIMDM",
	region: "Northern Ireland",
	attribution:
		"NISRA. Northern Ireland Multiple Deprivation Measure 2017. nisra.gov.uk",
};

interface NIMDMChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, NIMDMDataset>;
	aggregatedData: Record<number, AggregatedNIMDMData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function NIMDMChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: NIMDMChartProps) {
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const stats = resolveDeprivationStats({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.lgdStats,
		selectedArea,
		fineArea: {
			type: "superOutputArea",
			records: dataset.data,
			statsFor: (record) => ({
				averageNIMDMRank: record.nimdmRank,
				averageNIMDMDecile: record.nimdmDecile,
			}),
		},
	});

	return (
		<DeprivationChart
			index={NIMDM}
			dataset={dataset}
			activeDataset={activeDataset}
			selectedArea={selectedArea}
			decile={stats?.averageNIMDMDecile ?? null}
			detail={
				stats ? { kind: "rank", value: stats.averageNIMDMRank } : null
			}
			setActiveViz={setActiveViz}
			extraClassName="block w-full text-left"
		/>
	);
}
