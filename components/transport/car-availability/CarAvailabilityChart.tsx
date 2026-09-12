"use client";

import {
	ActiveViz,
	AggregatedCarAvailabilityData,
	Dataset,
	SelectedArea,
	CarAvailabilityDataset,
} from "@lib/types";
import {
	CAR_AVAILABILITY_COLORS,
	CAR_AVAILABILITY_LEVELS,
} from "@/lib/types/carAvailability";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

interface CarAvailabilityChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CarAvailabilityDataset>;
	aggregatedData: Record<number, AggregatedCarAvailabilityData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	setActiveViz: (value: ActiveViz) => void;
}

function computeBreakdown(
	dataset: CarAvailabilityDataset,
	aggregatedData: Record<number, AggregatedCarAvailabilityData> | null,
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

export default function CarAvailabilityChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: CarAvailabilityChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];
	const isActive =
		activeDataset?.type === "carAvailability" &&
		activeDataset.id === dataset?.id;

	const breakdown = dataset
		? computeBreakdown(
				dataset,
				aggregatedData,
				selectedArea,
				year,
				chartsLoading,
			)
		: null;

	const hasData = breakdown !== null && breakdown.total > 0;
	const heightClass = isActive ? "min-h-[150px]" : "min-h-[65px]";

	if (!dataset) return null;

	const bars = hasData
		? CAR_AVAILABILITY_LEVELS.map(({ key, label }) => ({
				key,
				label,
				color: CAR_AVAILABILITY_COLORS[key],
				count: breakdown[key],
				pct: (breakdown[key] / breakdown.total) * 100,
			}))
		: [];

	return (
		<ChartCard
			heading={`Car Availability [${dataset.year}]`}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England &amp; Wales
				</span>
			}
			accent={hasData ? CAR_AVAILABILITY_COLORS.noCar : null}
			isActive={isActive}
			minHeightClassName={`transition-[min-height] duration-300 ease-in-out ${heightClass} block w-full text-left`}
			title="Office for National Statistics. Census 2021: Car or van availability, England and Wales. TS045."
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
