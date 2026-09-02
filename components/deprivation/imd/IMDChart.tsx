"use client";
import {
	ActiveViz,
	AggregatedIMDData,
	Dataset,
	IMDDataset,
	SelectedArea,
} from "@lib/types";
import { useIsDark } from "@/lib/context/ThemeContext";
import DecileChart from "../DecileChart";

interface IMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IMDDataset>;
	aggregatedData: Record<number, AggregatedIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function computeImdStats(
	dataset: IMDDataset,
	aggregatedData: Record<number, AggregatedIMDData> | null,
	selectedArea: SelectedArea | null,
) {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	if (selectedArea.type === "lsoa") {
		const record = dataset.data[selectedArea.code];
		return record
			? { averageIMDScore: record.imdScore, averageIMDDecile: record.imdDecile }
			: null;
	}

	if (selectedArea.type === "localAuthority")
		return dataset.ladStats[selectedArea.code] ?? null;

	if (selectedArea.type === "ward" && selectedArea.data)
		return dataset.ladStats[selectedArea.data.ladCode] ?? null;

	return null;
}

export default function IMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: IMDChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	if (!dataset) return null;

	const imdStats = computeImdStats(dataset, aggregatedData, selectedArea);
	const isActive = !!(activeDataset?.type === "imd" && activeDataset.id === dataset.id);

	return (
		<DecileChart
			title="Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk"
			heading={`Deprivation (IMD) [${dataset.year}]`}
			region="England"
			decile={imdStats ? Math.round(imdStats.averageIMDDecile) : null}
			hasData={imdStats !== null}
			footer={
				imdStats && (
					<span className={`text-[9px] leading-none ${isDark ? "text-gray-400" : "text-gray-500"}`}>
						Score {imdStats.averageIMDScore.toFixed(1)}
					</span>
				)
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
