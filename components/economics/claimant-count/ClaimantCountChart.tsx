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

const ACCENT = "#f59e0b";

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

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? ACCENT : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

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
				<div className="flex items-end justify-between gap-1.5 flex-1">
					<div className={`text-2xl font-bold leading-none ${isDark ? "text-gray-100" : "text-gray-800"}`}>
						{stats!.totalRate.toFixed(1)}
						<span className={`text-[10px] font-normal ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
							% of 16-64
						</span>
					</div>
					<div className={`flex flex-col items-end text-right ${isDark ? "text-gray-400" : "text-gray-500"}`}>
						<span className="text-[10px]">youth rate</span>
						<span className={`text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-700"}`}>
							{stats!.youthRate.toFixed(1)}%
						</span>
					</div>
				</div>
			)}
		</button>
	);
}
