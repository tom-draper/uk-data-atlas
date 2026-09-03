"use client";
import {
	ActiveViz,
	AggregatedWIMDData,
	Dataset,
	WIMDDataset,
	SelectedArea,
} from "@lib/types";
import { useIsDark } from "@/lib/context/ThemeContext";
import DecileChart from "../DecileChart";

interface WIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, WIMDDataset>;
	aggregatedData: Record<number, AggregatedWIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function computeWimdStats(
	dataset: WIMDDataset,
	aggregatedData: Record<number, AggregatedWIMDData> | null,
	selectedArea: SelectedArea | null,
) {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	if (selectedArea.type === "lsoa") {
		const record = dataset.data[selectedArea.code];
		return record
			? {
					averageWIMDScore: record.wimdScore,
					averageWIMDRank: record.wimdRank,
					averageWIMDDecile: record.wimdDecile,
				}
			: null;
	}

	if (selectedArea.type === "localAuthority")
		return dataset.ladStats[selectedArea.code] ?? null;

	if (selectedArea.type === "ward" && selectedArea.data)
		return dataset.ladStats[selectedArea.data.ladCode] ?? null;

	return null;
}

export default function WIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: WIMDChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const wimdStats = computeWimdStats(dataset, aggregatedData, selectedArea);
	const isActive =
		activeDataset?.type === "wimd" && activeDataset.id === dataset.id;

	return (
		<DecileChart
			title="Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales"
			heading={`Deprivation (WIMD) [${dataset.year}]`}
			region="Wales"
			decile={wimdStats ? Math.round(wimdStats.averageWIMDDecile) : null}
			hasData={wimdStats !== null}
			extraClassName="block w-full text-left"
			footer={
				selectedArea &&
				wimdStats &&
				Number.isFinite(wimdStats.averageWIMDRank) ? (
					<span
						className={`text-[9px] leading-none ${isDark ? "text-gray-400" : "text-gray-500"}`}
					>
						Rank{" "}
						{Math.round(wimdStats.averageWIMDRank).toLocaleString()}
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
