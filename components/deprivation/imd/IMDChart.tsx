"use client";
import {
	ActiveViz,
	AggregatedIMDData,
	Dataset,
	IMDDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivation } from "../deprivationStats";

const IMD: DeprivationIndex = {
	datasetType: "imd",
	label: "IMD",
	region: "England",
	attribution:
		"Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk",
	metric: "score",
	metricMaximum: 92.735,
	areaNoun: "LSOAs",
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

	const resolved = resolveDeprivation({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.ladStats,
		selectedArea,
		fineArea: { type: "lsoa", records: dataset.data },
	});

	return (
		<DeprivationChart
			index={IMD}
			dataset={dataset}
			activeDataset={activeDataset}
			view={
				resolved === null
					? null
					: resolved.kind === "summary"
						? resolved
						: {
								kind: "area",
								decile: resolved.record.imdDecile,
								detail: {
									kind: "score",
									value: resolved.record.imdScore,
								},
							}
			}
			setActiveViz={setActiveViz}
		/>
	);
}
