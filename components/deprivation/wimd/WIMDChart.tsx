"use client";
import {
	ActiveViz,
	AggregatedWIMDData,
	Dataset,
	WIMDDataset,
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

interface WIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, WIMDDataset>;
	aggregatedData: Record<number, AggregatedWIMDData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const DECILE_COLORS = [
	"#15803d", // 1 - least deprived
	"#16a34a", // 2
	"#22c55e", // 3
	"#4ade80", // 4
	"#a3e635", // 5
	"#eab308", // 6
	"#f59e0b", // 7
	"#f97316", // 8
	"#ef4444", // 9
	"#dc2626", // 10 - most deprived
];

function computeWimdStats(
	dataset: WIMDDataset,
	aggregatedData: Record<number, AggregatedWIMDData> | null,
	selectedArea: SelectedArea | null,
	chartsLoading: boolean,
) {
	if (chartsLoading) return null;
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	if (selectedArea.type === "lsoa") {
		const record = dataset.data[selectedArea.code];
		return record
			? { averageWIMDScore: record.wimdScore, averageWIMDRank: record.wimdRank, averageWIMDDecile: record.wimdDecile }
			: null;
	}

	if (selectedArea.type === "localAuthority")
		return dataset.ladStats[selectedArea.code] ?? null;

	if (selectedArea.type === "ward" && selectedArea.data)
		return dataset.ladStats[selectedArea.data.ladCode] ?? null;

	return null;
}

export default function WIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: WIMDChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const wimdStats = dataset
		? computeWimdStats(dataset, aggregatedData, selectedArea, chartsLoading)
		: null;

	const isActive =
		activeDataset?.type === "wimd" && activeDataset.id === dataset?.id;

	const decile = wimdStats ? Math.round(wimdStats.averageWIMDDecile) : null;
	const displayDecile = decile ? 11 - decile : null;
	const decileColor = displayDecile ? DECILE_COLORS[displayDecile - 1] : "#9ca3af";
	const hasData = wimdStats !== null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? decileColor : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-[72px] block w-full text-left")}
			title="Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales"
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
			<div className="relative z-10 flex flex-col flex-1">
				<div className="flex items-start justify-between mb-1.5 shrink-0">
					<h3 className={chartHeadingClass(isDark)}>
						Deprivation (WIMD) [{dataset.year}]
					</h3>
					<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Wales</span>
				</div>
				{hasData && wimdStats ? (
					<div className="flex items-start gap-2.5">
						<div className="shrink-0 w-8 text-right leading-none mt-[-2px]">
							<span
								className="text-3xl font-bold leading-none"
								style={{ color: decileColor }}
							>
								{displayDecile}
							</span>
						</div>
						<div className="flex-1 flex flex-col gap-1.5">
							<div className="flex gap-[2px]">
								{DECILE_COLORS.map((color, i) => (
									<div
										key={i}
										className="flex-1 h-3 rounded-[2px]"
										style={{
											backgroundColor:
												displayDecile === i + 1
													? color
													: isDark
														? "rgba(255,255,255,0.1)"
														: "rgba(0,0,0,0.08)",
										}}
									/>
								))}
							</div>
							<div className="flex justify-between">
								<span className={`text-[9px] leading-none ${isDark ? "text-gray-500" : "text-gray-400"}`}>least deprived</span>
								{selectedArea && Number.isFinite(wimdStats.averageWIMDRank) && (
									<span className={`text-[9px] leading-none ${isDark ? "text-gray-400" : "text-gray-500"}`}>Rank {Math.round(wimdStats.averageWIMDRank).toLocaleString()}</span>
								)}
							</div>
						</div>
					</div>
				) : (
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
				)}
			</div>
		</button>
	);
}
