"use client";
import {
	ActiveViz,
	AggregatedSchoolPerformanceData,
	SchoolPerformanceDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";
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
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive = activeDataset?.type === "schoolPerformance" && activeDataset.id === dataset?.id;
	const hasData = stats !== null && stats.ptL2basics94 != null;
	const color = gradeColor(stats?.ptL2basics94 ?? null);

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? color : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	const pct = stats?.ptL2basics94 ?? 0;
	const barWidth = Math.min(pct, 100);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="Department for Education. Key Stage 4 Performance 2023/24. explore-education-statistics.service.gov.uk"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>GCSE Performance [2023/24]</h3>
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>England</span>
			</div>

			{!hasData ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span className="text-2xl font-bold leading-none" style={{ color }}>
								{pct.toFixed(1)}
							</span>
							<span className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
								% grade 4+
							</span>
						</div>
						<span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
							{stats!.ptL2basics95 != null ? `${stats!.ptL2basics95.toFixed(1)}% grade 5+` : ""}
						</span>
					</div>
					<div className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}>
						<div
							className="h-full rounded-xs transition-all duration-300"
							style={{ width: `${barWidth}%`, backgroundColor: color }}
						/>
					</div>
				</div>
			)}
		</button>
	);
}
