"use client";
import {
	ActiveViz,
	AggregatedFuelPovertyData,
	Dataset,
	FuelPovertyDataset,
	SelectedArea,
} from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
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

interface Props {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, FuelPovertyDataset>;
	aggregatedData: Record<number, AggregatedFuelPovertyData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const colorForRate = (rate: number) =>
	rate >= 15
		? "#dc2626"
		: rate >= 10
			? "#f97316"
			: rate >= 7
				? "#eab308"
				: "#16a34a";
const formatCount = (count: number) =>
	count >= 1_000_000
		? `${(count / 1_000_000).toFixed(1)}m`
		: `${Math.round(count / 1_000)}k`;

export default function FuelPovertyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: Props) {
	const dataset = availableDatasets[year];
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const record =
		dataset && selectedArea?.type === "lsoa"
			? dataset.data[selectedArea.code]
			: null;
	const stats = record
		? {
				fuelPovertyRate: record.fuelPovertyRate,
				fuelPoorHouseholdCount: record.fuelPoorHouseholdCount,
			}
		: dataset
			? (aggregatedData?.[dataset.year] ?? null)
			: null;
	const active =
		activeDataset?.type === "fuelPoverty" &&
		activeDataset.id === dataset?.id;
	const accent = stats ? colorForRate(stats.fuelPovertyRate) : null;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accent,
		active,
		isDark,
	);
	if (!dataset) return null;
	const barWidth = (Math.min(stats?.fuelPovertyRate ?? 0, 20) / 20) * 100;
	return (
		<button
			type="button"
			style={style}
			className={cardClass(active, isDark, "min-h-20")}
			title="DESNZ. Fuel poverty (LILEE), England, 2024."
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
					Fuel Poverty [2024]
				</h3>
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England
				</span>
			</div>
			{!stats ? (
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
								style={{ color: accent! }}
							>
								{stats.fuelPovertyRate.toFixed(1)}
							</span>
							<span
								className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								% households
							</span>
						</div>
						<span
							className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							{formatCount(stats.fuelPoorHouseholdCount)} affected
						</span>
					</div>
					<div
						className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}
					>
						<div
							className="h-full rounded-xs transition-all duration-300"
							style={{
								width: `${barWidth}%`,
								backgroundColor: accent!,
							}}
						/>
					</div>
				</div>
			)}
		</button>
	);
}
