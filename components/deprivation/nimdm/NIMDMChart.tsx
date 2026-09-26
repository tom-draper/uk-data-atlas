"use client";
import {
	ActiveViz,
	AggregatedNIMDMData,
	Dataset,
	NIMDMDataset,
	SelectedArea,
} from "@lib/types";
import { DeprivationChart, type DeprivationIndex } from "../DeprivationChart";
import { resolveDeprivation } from "../deprivationStats";

const NIMDM: DeprivationIndex = {
	datasetType: "nimdm",
	label: "NIMDM",
	region: "Northern Ireland",
	attribution:
		"NISRA. Northern Ireland Multiple Deprivation Measure 2017. nisra.gov.uk",
	metric: "rank",
	metricMaximum: 890,
	areaNoun: "super output areas",
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

	const resolved = resolveDeprivation({
		aggregated: aggregatedData?.[dataset.year] ?? null,
		ladStats: dataset.lgdStats,
		selectedArea,
		fineArea: { type: "superOutputArea", records: dataset.data },
	});

	return (
		<DeprivationChart
			index={NIMDM}
			dataset={dataset}
			activeDataset={activeDataset}
			view={
				resolved === null
					? null
					: resolved.kind === "summary"
						? resolved
						: {
								kind: "area",
								// NISRA publishes no decile for these areas, so none is shown.
								decile: null,
								detail: {
									kind: "rank",
									value: resolved.record.nimdmRank,
								},
							}
			}
			setActiveViz={setActiveViz}
		/>
	);
}
