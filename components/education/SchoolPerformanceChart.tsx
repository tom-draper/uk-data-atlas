"use client";
import {
	ActiveViz,
	AggregatedSchoolPerformanceData,
	SchoolPerformanceDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface SchoolPerformanceChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, SchoolPerformanceDataset>;
	aggregatedData: Record<number, AggregatedSchoolPerformanceData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function gradeColor(pct: number | null): string {
	if (pct == null) return "#9ca3af";
	if (pct >= 70) return "#16a34a";
	if (pct >= 60) return "#4ade80";
	if (pct >= 50) return "#eab308";
	if (pct >= 40) return "#f97316";
	return "#dc2626";
}

function computeStats(
	dataset: SchoolPerformanceDataset,
	aggregatedData: Record<number, AggregatedSchoolPerformanceData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedSchoolPerformanceData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const r = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!r) return null;
		return { ptL2basics94: r.ptL2basics94, ptL2basics95: r.ptL2basics95, avgAtt8: r.avgAtt8, avgP8score: r.avgP8score };
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function SchoolPerformanceChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: SchoolPerformanceChartProps) {
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive = activeDataset?.type === "schoolPerformance" && activeDataset.id === dataset?.id;
	const hasData = stats !== null && stats.ptL2basics94 != null;
	const color = gradeColor(stats?.ptL2basics94 ?? null);

	if (!dataset) return null;

	const pct = stats?.ptL2basics94 ?? 0;
	const barWidth = Math.min(pct, 100);

	return (
		<ChartCard
			heading="GCSE Performance [2023/24]"
			headerEnd={
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
					England
				</span>
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="Department for Education. Key Stage 4 Performance 2023/24. explore-education-statistics.service.gov.uk"
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
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
				barColor={color}
			/>
		</ChartCard>
	);
}
