"use client";
import {
	ActiveViz,
	AggregatedSchoolPerformanceGapData,
	SchoolPerformanceGapDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";
import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";

interface SchoolPerformanceDisadvantageChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SchoolPerformanceGapDataset>;
	aggregatedData: Record<number, AggregatedSchoolPerformanceGapData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeYearResolver;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function computeStats(
	dataset: SchoolPerformanceGapDataset,
	aggregatedData: Record<number, AggregatedSchoolPerformanceGapData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeYearResolver | undefined,
): AggregatedSchoolPerformanceGapData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const record =
			dataset.data[code] ??
			dataset.data[
				codeMapper?.getCodeForYear(
					"localAuthority",
					code,
					dataset.boundaryYear,
				) ?? ""
			];
		if (!record) return null;
		return {
			att8Gap: record.att8Gap,
			att8Disadvantaged: record.att8Disadvantaged,
			att8NotDisadvantaged: record.att8NotDisadvantaged,
		};
	};

	if (selectedArea.type === "localAuthority")
		return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode)
		return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function SchoolPerformanceDisadvantageChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: SchoolPerformanceDisadvantageChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive =
		activeDataset?.type === "schoolPerformanceGap" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null && stats.att8Gap != null;
	const color = useHeatmapValueColor(
		"schoolPerformanceGap",
		hasData ? stats.att8Gap : null,
	);

	if (!dataset) return null;

	const gap = stats?.att8Gap ?? 0;
	// Roughly the widest gap in England, so the bar spans the real spread.
	const barWidth = Math.min((gap / 30) * 100, 100);

	return (
		<ChartCard
			heading="Attainment 8 Gap [2024/25]"
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England
				</span>
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="Department for Education. Key Stage 4 Performance 2024/25. Difference in average Attainment 8 between pupils not known to be disadvantaged and disadvantaged pupils."
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={hasData}
				value={gap.toFixed(1)}
				unit="pts behind"
				secondary={
					stats?.att8Disadvantaged != null &&
					stats?.att8NotDisadvantaged != null
						? `${stats.att8Disadvantaged.toFixed(1)} vs ${stats.att8NotDisadvantaged.toFixed(1)}`
						: undefined
				}
				barWidth={barWidth}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
