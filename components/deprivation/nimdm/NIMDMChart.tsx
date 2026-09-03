"use client";
import {
	ActiveViz,
	AggregatedNIMDMData,
	Dataset,
	NIMDMDataset,
	SelectedArea,
} from "@lib/types";
import { useIsDark } from "@/lib/context/ThemeContext";
import DecileChart from "../DecileChart";

interface NIMDMChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, NIMDMDataset>;
	aggregatedData: Record<number, AggregatedNIMDMData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function computeNimdmStats(
	dataset: NIMDMDataset,
	aggregatedData: Record<number, AggregatedNIMDMData> | null,
	selectedArea: SelectedArea | null,
) {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	if (selectedArea.type === "localAuthority")
		return dataset.lgdStats[selectedArea.code] ?? null;

	if (selectedArea.type === "ward" && selectedArea.data)
		return dataset.lgdStats[selectedArea.data.ladCode] ?? null;

	if (selectedArea.type === "superOutputArea") {
		const soa = dataset.data[selectedArea.code];
		if (!soa) return null;
		return {
			averageNIMDMRank: soa.nimdmRank,
			averageNIMDMDecile: soa.nimdmDecile,
		};
	}

	return null;
}

export default function NIMDMChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: NIMDMChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const nimdmStats = computeNimdmStats(dataset, aggregatedData, selectedArea);
	const isActive =
		activeDataset?.type === "nimdm" && activeDataset.id === dataset.id;

	return (
		<DecileChart
			title="NISRA. Northern Ireland Multiple Deprivation Measure 2017. nisra.gov.uk"
			heading={`Deprivation (NIMDM) [${dataset.year}]`}
			region="Northern Ireland"
			decile={
				nimdmStats ? Math.round(nimdmStats.averageNIMDMDecile) : null
			}
			hasData={nimdmStats !== null}
			extraClassName="block w-full text-left"
			footer={
				selectedArea &&
				nimdmStats &&
				Number.isFinite(nimdmStats.averageNIMDMRank) ? (
					<span
						className={`text-[9px] leading-none ${isDark ? "text-gray-400" : "text-gray-500"}`}
					>
						Rank{" "}
						{Math.round(
							nimdmStats.averageNIMDMRank,
						).toLocaleString()}
					</span>
				) : null
			}
			isActive={isActive}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		/>
	);
}
