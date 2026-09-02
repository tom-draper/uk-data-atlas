"use client";
import {
	ActiveViz,
	AggregatedChildPovertyData,
	ChildPovertyDataset,
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

interface ChildPovertyChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, ChildPovertyDataset>;
	aggregatedData: Record<number, AggregatedChildPovertyData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const accentForRate = (rate: number) =>
	rate >= 30
		? "#dc2626"
		: rate >= 20
			? "#f97316"
			: rate >= 12
				? "#eab308"
				: "#16a34a";
const formatCount = (value: number) =>
	value >= 1_000_000
		? `${(value / 1_000_000).toFixed(1)}m`
		: `${Math.round(value / 1_000)}k`;

function statsFor(
	dataset: ChildPovertyDataset,
	aggregatedData: Record<number, AggregatedChildPovertyData> | null,
	selectedArea: SelectedArea | null,
	codeMapper?: CodeMapper,
): AggregatedChildPovertyData | null {
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
	return record
		? {
				childCount: record.childCount,
				childPovertyRate: record.childPovertyRate,
			}
		: null;
}

export default function ChildPovertyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChildPovertyChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets[year];
	const stats = dataset
		? statsFor(dataset, aggregatedData, selectedArea, codeMapper)
		: null;
	const active =
		activeDataset?.type === "childPoverty" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const rate = stats?.childPovertyRate ?? 0;
	const accent = hasData ? accentForRate(rate) : null;
	const color = accent ?? undefined;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accent,
		active,
		isDark,
	);
	if (!dataset) return null;

	// Rates above 40% are uncommon; cap the bar there to retain contrast.
	const barWidth = Math.min((rate / 40) * 100, 100);

	return (
		<button
			type="button"
			style={style}
			className={cardClass(active, isDark, "min-h-20")}
			title="DWP. Children in relative low-income families, before housing costs."
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
					Child Poverty [FYE {dataset.year}]
				</h3>
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					England
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
								{rate.toFixed(1)}
							</span>
							<span
								className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								% children
							</span>
						</div>
						<span
							className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							{formatCount(stats!.childCount)} affected
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
