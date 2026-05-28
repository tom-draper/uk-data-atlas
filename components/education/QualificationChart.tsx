"use client";

import {
	ActiveViz,
	AggregatedQualificationData,
	Dataset,
	QualificationDataset,
	SelectedArea,
} from "@lib/types";
import {
	QUALIFICATION_COLORS,
	QUALIFICATION_LEVELS,
} from "@/lib/types/qualification";
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

interface QualificationChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, QualificationDataset>;
	aggregatedData: Record<number, AggregatedQualificationData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	setActiveViz: (value: ActiveViz) => void;
}

function computeBreakdown(
	dataset: QualificationDataset,
	aggregatedData: Record<number, AggregatedQualificationData> | null,
	selectedArea: SelectedArea | null,
	year: number,
	chartsLoading: boolean,
) {
	if (chartsLoading) return null;

	if (selectedArea === null) return aggregatedData?.[year]?.breakdown ?? null;

	if (selectedArea.type === "localAuthority")
		return dataset.data[selectedArea.code]?.breakdown ?? null;

	if (selectedArea.type === "ward" && selectedArea.data?.ladCode)
		return dataset.data[selectedArea.data.ladCode]?.breakdown ?? null;

	return null;
}

export default function QualificationChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: QualificationChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	const isActive =
		activeDataset?.type === "qualification" &&
		activeDataset.id === dataset?.id;

	const breakdown = dataset
		? computeBreakdown(dataset, aggregatedData, selectedArea, year, chartsLoading)
		: null;

	const hasData = breakdown !== null && breakdown.total > 0;
	const accentColor = QUALIFICATION_COLORS.level4Plus;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? accentColor : null,
		isActive,
		isDark,
	);
	const heightClass = isActive ? "h-[150px]" : "h-[65px]";

	if (!dataset) return null;

	const bars = hasData
		? QUALIFICATION_LEVELS.map(({ key, label }) => ({
				key,
				label,
				color: QUALIFICATION_COLORS[key],
				count: breakdown![key] as number,
				pct: ((breakdown![key] as number) / breakdown!.total) * 100,
			}))
		: [];

	return (
		<button
			type="button"
			style={style}
			className={cardClass(
				isActive,
				isDark,
				`transition-[height] duration-300 ease-in-out ${heightClass} block w-full text-left`,
			)}
			title="Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067."
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
			<div className="flex items-center justify-between mb-1.5">
				<h3 className={chartHeadingClass(isDark)}>
					Qualifications [{dataset.year}]
				</h3>
				<span
					className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					Eng &amp; Wales
				</span>
			</div>

			{!hasData ? (
				<div className="h-10 flex items-center justify-center">
					{chartsLoading ? (
						<ChartContentPlaceholder className="size-full" />
					) : (
						<div
							className={`text-xs pb-2 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="space-y-1">
					<div className="flex h-5 rounded overflow-hidden w-full gap-0">
						{bars.map(({ key, label, color, pct, count }) => (
							<div
								key={key}
								style={{
									width: `${pct}%`,
									backgroundColor: color,
								}}
								title={`${label}: ${count.toLocaleString()} (${pct.toFixed(1)}%)`}
								className="hover:opacity-80 transition-opacity"
							>
								{pct > 8 && (
									<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
										{pct.toFixed(0)}%
									</span>
								)}
							</div>
						))}
					</div>

					{isActive && (
						<div className="animate-in fade-in duration-200 mt-1">
							<div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
								{bars.map(({ key, label, color, pct }) => (
									<div
										key={key}
										className="flex items-center gap-1 min-w-0"
									>
										<div
											className="size-1.5 rounded-sm shrink-0"
											style={{ backgroundColor: color }}
										/>
										<span
											className={`text-[9px] truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}
											title={label}
										>
											{pct.toFixed(1)}% {label}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</button>
	);
}
