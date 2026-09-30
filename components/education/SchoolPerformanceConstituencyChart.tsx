"use client";
import {
	ActiveViz,
	AggregatedSchoolPerformanceData,
	SchoolPerformanceConstituencyDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { ConstituencyEstimateIndicator } from "@/components/ConstituencyEstimateIndicator";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import {
	selectedAreaConstituencyRecord,
	type ConstituencyResolver,
} from "@/lib/helpers/selectedAreaConstituency";

interface SchoolPerformanceConstituencyChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SchoolPerformanceConstituencyDataset>;
	aggregatedData: Record<number, AggregatedSchoolPerformanceData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: ConstituencyResolver;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export function resolveSchoolPerformanceConstituencyStats(
	dataset: SchoolPerformanceConstituencyDataset,
	aggregatedData: Record<number, AggregatedSchoolPerformanceData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: ConstituencyResolver | undefined,
): AggregatedSchoolPerformanceData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const record = selectedAreaConstituencyRecord(
		dataset.data,
		selectedArea,
		codeMapper,
		dataset.boundaryYear,
	);
	if (!record) return null;
	return {
		ptL2basics94: record.ptL2basics94,
		ptL2basics95: record.ptL2basics95,
		avgAtt8: record.avgAtt8,
		avgP8score: record.avgP8score,
	};
}

export default function SchoolPerformanceConstituencyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: SchoolPerformanceConstituencyChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? resolveSchoolPerformanceConstituencyStats(
				dataset,
				aggregatedData,
				selectedArea,
				codeMapper,
			)
		: null;

	const isActive =
		activeDataset?.type === "schoolPerformanceConstituency" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null && stats.ptL2basics94 != null;
	const color = useHeatmapValueColor(
		"schoolPerformanceConstituency",
		hasData ? stats.ptL2basics94 : null,
	);

	if (!dataset) return null;

	const pct = stats?.ptL2basics94 ?? 0;
	const barWidth = Math.min(pct, 100);

	return (
		<ChartCard
			heading="GCSE Performance [2024/25]"
			headerEnd={
				<ConstituencyEstimateIndicator
					selectedArea={selectedArea}
					hasData={hasData}
					isDark={isDark}
					fallback="England"
				/>
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="Department for Education. Key Stage 4 Performance 2024/25. explore-education-statistics.service.gov.uk"
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
				value={pct.toFixed(1)}
				unit="% grade 4+"
				secondary={
					stats?.ptL2basics95 != null
						? `${stats.ptL2basics95.toFixed(1)}% grade 5+`
						: undefined
				}
				barWidth={barWidth}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
