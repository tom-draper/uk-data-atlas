"use client";
import {
	ActiveViz,
	AggregatedClaimantCountData,
	ClaimantCountDataset,
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

interface ClaimantCountChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, ClaimantCountDataset>;
	aggregatedData: Record<number, AggregatedClaimantCountData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function rateColor(rate: number): string {
	if (rate <= 2.5) return "#16a34a";
	if (rate <= 4) return "#eab308";
	if (rate <= 6) return "#f97316";
	return "#dc2626";
}

function computeStats(
	dataset: ClaimantCountDataset,
	aggregatedData: Record<number, AggregatedClaimantCountData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedClaimantCountData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const r = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!r) return null;
		return { totalCount: r.totalCount, totalRate: r.totalRate, youthCount: r.youthCount, youthRate: r.youthRate };
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function ClaimantCountChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ClaimantCountChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive = activeDataset?.type === "claimantCount" && activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const color = rateColor(stats?.totalRate ?? 0);

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? color : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	const rate = stats?.totalRate ?? 0;
	// Bar capped at 10% = full width
	const barWidth = Math.min(rate / 10 * 100, 100);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="ONS/Nomis. Claimant Count (UC + JSA). nomisweb.co.uk"
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
				<h3 className={chartHeadingClass(isDark)}>Claimant Count [{dataset.month}]</h3>
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
								{rate.toFixed(1)}
							</span>
							<span className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
								% of 16-64
							</span>
						</div>
						<span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
							{stats!.youthRate.toFixed(1)}% youth
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
