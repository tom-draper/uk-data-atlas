"use client";
import {
	ActiveViz,
	AggregatedNHSWaitingData,
	NHSWaitingDataset,
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

interface NHSWaitingChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, NHSWaitingDataset>;
	aggregatedData: Record<number, AggregatedNHSWaitingData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

// 18-week NHS target: 92% treated within 18 weeks = max 8% over
const TARGET_PCT = 8;

function waitColor(pctOver: number): string {
	if (pctOver <= TARGET_PCT) return "#16a34a";
	if (pctOver <= 20) return "#eab308";
	if (pctOver <= 35) return "#f97316";
	return "#dc2626";
}

function computeStats(
	dataset: NHSWaitingDataset,
	aggregatedData: Record<number, AggregatedNHSWaitingData> | null,
	selectedArea: SelectedArea | null,
): AggregatedNHSWaitingData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const getForLad = (ladCode: string) => {
		const icbCode = dataset.ladToIcb[ladCode];
		if (!icbCode) return null;
		const r = dataset.data[icbCode];
		if (!r) return null;
		return { total: r.total, over18Weeks: r.over18Weeks, pctOver18Weeks: r.pctOver18Weeks };
	};

	if (selectedArea.type === "localAuthority") return getForLad(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return getForLad(selectedArea.data.ladCode);
	return null;
}

export default function NHSWaitingChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: NHSWaitingChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea)
		: null;

	const isActive = activeDataset?.type === "nhsWaiting" && activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const color = waitColor(stats?.pctOver18Weeks ?? 0);

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? color : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	const pct = stats?.pctOver18Weeks ?? 0;
	// Bar shows % over 18 weeks, capped at 50% for visual scale
	const barWidth = Math.min(pct / 50 * 100, 100);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="NHS England. Referral to Treatment waiting times. england.nhs.uk"
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
			<div className="relative z-10 flex items-start justify-between mb-1 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>NHS Waiting Times [{dataset.month}]</h3>
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>England only</span>
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
				<div className="flex-1 flex flex-col justify-end gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span className="text-2xl font-bold" style={{ color }}>
								{pct.toFixed(1)}
							</span>
							<span className={`text-[10px] font-normal ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
								% over 18 wks
							</span>
						</div>
						<span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
							target &lt;{TARGET_PCT}%
						</span>
					</div>
					<div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}>
						<div
							className="h-full rounded-full transition-all duration-300"
							style={{ width: `${barWidth}%`, backgroundColor: color }}
						/>
					</div>
				</div>
			)}
		</button>
	);
}
