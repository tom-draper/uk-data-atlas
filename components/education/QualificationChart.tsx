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
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

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
	const heightClass = isActive ? "min-h-[150px]" : "min-h-[65px]";

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
		<ChartCard
			heading={`Qualifications [${dataset.year}]`}
			headerEnd={
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
					England &amp; Wales
				</span>
			}
			accent={hasData ? accentColor : null}
			isActive={isActive}
			minHeightClassName={`transition-[min-height] duration-300 ease-in-out ${heightClass} block w-full text-left`}
			title="Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067."
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			{!hasData ? (
				<div className="flex-1">
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
		</ChartCard>
	);
}
