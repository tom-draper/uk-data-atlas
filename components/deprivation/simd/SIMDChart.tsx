"use client";
import {
	ActiveViz,
	AggregatedSIMDData,
	Dataset,
	SIMDDataset,
	SelectedArea,
} from "@lib/types";
import { useIsDark } from "@/lib/context/ThemeContext";
import DecileChart from "../DecileChart";

interface SIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SIMDDataset>;
	aggregatedData: Record<number, AggregatedSIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function computeSimdStats(
	dataset: SIMDDataset,
	aggregatedData: Record<number, AggregatedSIMDData> | null,
	selectedArea: SelectedArea | null,
) {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	if (selectedArea.type === "localAuthority")
		return dataset.councilStats[selectedArea.code] ?? null;

	if (selectedArea.type === "ward" && selectedArea.data)
		return dataset.councilStats[selectedArea.data.ladCode] ?? null;

	if (selectedArea.type === "dataZone") {
		const dz = dataset.data[selectedArea.code];
		if (!dz) return null;
		return {
			averageSIMDRank: dz.simdRank,
			averageSIMDQuintile: dz.simdQuintile,
			averageSIMDDecile: dz.simdDecile,
		};
	}

	return null;
}

export default function SIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: SIMDChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const simdStats = computeSimdStats(dataset, aggregatedData, selectedArea);
	const isActive = activeDataset?.type === "simd" && activeDataset.id === dataset.id;

	return (
		<DecileChart
			title="Scottish Government. Scottish Index of Multiple Deprivation 2020v2. gov.scot"
			heading={`Deprivation (SIMD) [${dataset.year}]`}
			region="Scotland"
			decile={simdStats ? Math.round(simdStats.averageSIMDDecile) : null}
			hasData={simdStats !== null}
			extraClassName="block w-full text-left"
			footer={
				selectedArea && simdStats && Number.isFinite(simdStats.averageSIMDRank) ? (
					<span className={`text-[9px] leading-none ${isDark ? "text-gray-400" : "text-gray-500"}`}>
						Rank {Math.round(simdStats.averageSIMDRank).toLocaleString()}
					</span>
				) : null
			}
			isActive={isActive}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		/>
	);
}
