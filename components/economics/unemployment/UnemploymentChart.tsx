"use client";
import {
	ActiveViz,
	AggregatedUnemploymentData,
	UnemploymentDataset,
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

interface UnemploymentChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, UnemploymentDataset>;
	aggregatedData: Record<number, AggregatedUnemploymentData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#1e40af";
const LINE_COLOR = "#3b82f6";

function computeStats(
	dataset: UnemploymentDataset,
	aggregatedData: Record<number, AggregatedUnemploymentData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
): AggregatedUnemploymentData | null {
	if (selectedArea === null) {
		const agg = aggregatedData?.[dataset.latestYear] ?? null;
		if (!agg) return null;
		return agg;
	}

	const fromRecord = (code: string) => {
		const r = dataset.data[code] ?? dataset.data[codeMapper?.getCodeForYear("localAuthority", code, dataset.boundaryYear) ?? ""];
		if (!r) return null;
		const rates: Record<number, number> = {};
		for (const yr of dataset.years) {
			const v = r.rates[yr];
			if (v != null) rates[yr] = v;
		}
		return { years: dataset.years, latestYear: dataset.latestYear, rates };
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

function buildSparkline(stats: AggregatedUnemploymentData): { linePath: string; areaPath: string; lastPt: { x: number; y: number } } | null {
	const points = stats.years
		.map(yr => ({ yr, v: stats.rates[yr] }))
		.filter((p): p is { yr: number; v: number } => p.v != null);

	if (points.length < 2) return null;

	const W = 100, H = 100;
	const PAD_Y = 12; // keep line away from top/bottom edges

	const values = points.map(p => p.v);
	const min = Math.max(0, Math.min(...values) - 0.3);
	const max = Math.max(...values) + 0.3;

	const pts = points.map((p, i) => ({
		x: (i / (points.length - 1)) * W,
		y: PAD_Y + (1 - (p.v - min) / (max - min)) * (H - PAD_Y * 2),
	}));

	let linePath = `M ${pts[0].x},${pts[0].y}`;
	for (let i = 1; i < pts.length; i++) {
		linePath += ` L ${pts[i].x},${pts[i].y}`;
	}

	const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`;
	return { linePath, areaPath, lastPt: pts[pts.length - 1] };
}

export default function UnemploymentChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: UnemploymentChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive = activeDataset?.type === "unemployment" && activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const sparkline = stats ? buildSparkline(stats) : null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? ACCENT : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	const latestRate = stats?.rates[dataset.latestYear];

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="ONS. Model-based estimates of unemployment for local and unitary authorities. ons.gov.uk"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.latestYear,
				})
			}
		>
			<ChartLoadingBackground />

			{sparkline && (
				<svg
					className="absolute inset-0 size-full"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<defs>
						<linearGradient id="unemployment-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stopColor={LINE_COLOR} stopOpacity={isDark ? 0.2 : 0.12} />
							<stop offset="80%" stopColor={LINE_COLOR} stopOpacity={0} />
						</linearGradient>
					</defs>
					<path d={sparkline.areaPath} fill="url(#unemployment-area-gradient)" />
					<path d={sparkline.linePath} fill="none" stroke={LINE_COLOR} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
					<circle cx={sparkline.lastPt.x} cy={sparkline.lastPt.y} r="2" fill={LINE_COLOR} vectorEffect="non-scaling-stroke" />
				</svg>
			)}

			<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>
					Unemployment Rate [1996-{dataset.latestYear}]
				</h3>
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
				<div className="relative z-10 flex items-end justify-between gap-1.5 flex-1">
					<div className={`text-2xl font-bold leading-none ${isDark ? "text-gray-100" : "text-gray-800"}`}>
						{latestRate != null ? latestRate.toFixed(1) : "—"}
						<span className={`text-[10px] font-normal ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
							% ({dataset.latestYear})
						</span>
					</div>
				</div>
			)}
		</button>
	);
}
