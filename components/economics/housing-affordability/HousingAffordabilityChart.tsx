"use client";
import {
	ActiveViz,
	AggregatedHousingAffordabilityData,
	Dataset,
	HousingAffordabilityDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	ChartLoadingBackground,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	cardClass,
	chartHeadingClass,
	useCardAccent,
} from "@/lib/hooks/useCardAccent";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface HousingAffordabilityChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, HousingAffordabilityDataset>;
	aggregatedData: Record<number, AggregatedHousingAffordabilityData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const accentForRatio = (ratio: number) => {
	if (ratio <= 5) return "#16a34a";
	if (ratio <= 8) return "#eab308";
	if (ratio <= 10) return "#f97316";
	return "#dc2626";
};

function statsFor(
	dataset: HousingAffordabilityDataset,
	aggregatedData: Record<number, AggregatedHousingAffordabilityData> | null,
	selectedArea: SelectedArea | null,
	codeMapper?: CodeMapper,
): AggregatedHousingAffordabilityData | null {
	if (!selectedArea) return aggregatedData?.[dataset.year] ?? null;
	const code =
		selectedArea.type === "localAuthority"
			? selectedArea.code
			: selectedArea.type === "ward"
				? selectedArea.data?.ladCode
				: undefined;
	if (!code) return null;
	const record =
		dataset.data[code] ??
		dataset.data[
			codeMapper?.getCodeForYear(
				"localAuthority",
				code,
				dataset.boundaryYear,
			) ?? ""
		];
	return record ? { averageRatio: record.ratio } : null;
}

export default function HousingAffordabilityChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: HousingAffordabilityChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets[year];
	const stats = dataset
		? statsFor(dataset, aggregatedData, selectedArea, codeMapper)
		: null;
	const isActive =
		activeDataset?.type === "housingAffordability" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const ratio = stats?.averageRatio ?? 0;
	const color = hasData ? accentForRatio(ratio) : undefined;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		color ?? null,
		isActive,
		isDark,
	);

	if (!dataset) return null;
	const barWidth = Math.min((ratio / 15) * 100, 100);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="ONS. Median house price divided by gross annual residence-based earnings."
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
				<h3 className={chartHeadingClass(isDark)}>
					Housing Affordability [{dataset.year}]
				</h3>
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England &amp; Wales
				</span>
			</div>
			{!hasData ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span
								className="text-2xl font-bold leading-none"
								style={{ color }}
							>
								{ratio.toFixed(1)}
							</span>
							<span
								className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								years&apos; earnings
							</span>
						</div>
						<span
							className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							target ≤5 years
						</span>
					</div>
					<div
						className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}
					>
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
