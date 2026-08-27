"use client";

import {
	ActiveViz,
	AggregatedHomelessnessData,
	Dataset,
	HomelessnessDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	ChartLoadingBackground,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { cardClass, chartHeadingClass, useCardAccent } from "@/lib/hooks/useCardAccent";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface HomelessnessChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, HomelessnessDataset>;
	aggregatedData: Record<number, AggregatedHomelessnessData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const TARGET_RATE = 2.5;

function rateColor(rate: number): string {
	if (rate <= TARGET_RATE) return "#16a34a";
	if (rate <= 5) return "#eab308";
	if (rate <= 8) return "#f97316";
	return "#dc2626";
}

function computeStats(
	dataset: HomelessnessDataset,
	aggregatedData: Record<number, AggregatedHomelessnessData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedHomelessnessData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const record = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!record) return null;
		return {
			householdsInTemporaryAccommodation: record.householdsInTemporaryAccommodation,
			householdsPerThousand: record.householdsPerThousand,
			householdsWithChildren: record.householdsWithChildren,
			childrenInTemporaryAccommodation: record.childrenInTemporaryAccommodation,
		};
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function HomelessnessChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: HomelessnessChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	const stats = dataset ? computeStats(dataset, aggregatedData, selectedArea, codeMapper) : null;
	const isActive = activeDataset?.type === "homelessness" && activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const color = rateColor(stats?.householdsPerThousand ?? 0);
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(hasData ? color : null, isActive, isDark);

	if (!dataset) return null;

	const rate = stats?.householdsPerThousand ?? 0;
	// Bar shows households in temporary accommodation per 1,000 local households.
	const barWidth = Math.min(rate / 15 * 100, 100);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="Ministry of Housing, Communities and Local Government. Statutory homelessness statistics. gov.uk"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={() => setActiveViz({ vizId: dataset.id, datasetType: dataset.type, datasetYear: dataset.year })}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>Temporary Accommodation [Mar 2026]</h3>
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>England</span>
			</div>

			{!hasData ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? <ChartContentPlaceholder className="h-full" /> : (
						<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>No data available</div>
					)}
				</div>
			) : (
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span className="text-2xl font-bold leading-none" style={{ color }}>{rate.toFixed(1)}</span>
							<span className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>per 1k households</span>
						</div>
						<span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
							target &lt;{TARGET_RATE} per 1k
						</span>
					</div>
					<div className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}>
						<div className="h-full rounded-xs transition-all duration-300" style={{ width: `${barWidth}%`, backgroundColor: color }} />
					</div>
				</div>
			)}
		</button>
	);
}
