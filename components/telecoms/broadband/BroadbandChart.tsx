"use client";
import {
	ActiveViz,
	AggregatedBroadbandData,
	BroadbandDataset,
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

interface BroadbandChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BroadbandDataset>;
	aggregatedData: Record<number, AggregatedBroadbandData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#6366f1";

function computeStats(
	dataset: BroadbandDataset,
	aggregatedData: Record<number, AggregatedBroadbandData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedBroadbandData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const r = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!r) return null;
		return { pctSuperfast: r.pctSuperfast, pctUltrafast: r.pctUltrafast, pctFullFibre: r.pctFullFibre, pctGigabit: r.pctGigabit } as AggregatedBroadbandData;
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

function StatPill({ label, value, isDark }: { label: string; value: number | null; isDark: boolean }) {
	return (
		<div className={`flex flex-col items-center px-2 py-1 rounded ${isDark ? "bg-white/5" : "bg-black/5"}`}>
			<span className={`text-[9px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</span>
			<span className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				{value != null ? `${Math.round(value)}%` : "—"}
			</span>
		</div>
	);
}

export default function BroadbandChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	activeViz,
	setActiveViz,
}: BroadbandChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive =
		activeDataset?.type === "broadband" && activeDataset.id === dataset?.id;

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
			title="Ofcom. Connected Nations Report 2025. ofcom.org.uk"
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
			<div className="relative z-10 flex items-center justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>Fixed Broadband Coverage [{dataset.year}]</h3>
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
						{stats!.pctFullFibre != null ? `${Math.round(stats!.pctFullFibre)}` : "—"}
						<span className={`text-[10px] font-normal ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
							% full fibre
						</span>
					</div>
					<div className="flex gap-1 shrink-0">
						<StatPill label="Superfast" value={stats!.pctSuperfast} isDark={isDark} />
						<StatPill label="Ultrafast" value={stats!.pctUltrafast} isDark={isDark} />
						<StatPill label="Gigabit" value={stats!.pctGigabit} isDark={isDark} />
					</div>
				</div>
			)}
		</button>
	);
}
