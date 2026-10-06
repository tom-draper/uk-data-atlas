"use client";
import {
	ActiveViz,
	AggregatedUnemploymentData,
	UnemploymentDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";

interface UnemploymentChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, UnemploymentDataset>;
	aggregatedData: Record<number, AggregatedUnemploymentData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeYearResolver & LadResolver;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#1e40af";
const LINE_COLOR = "#3b82f6";

function computeStats(
	dataset: UnemploymentDataset,
	aggregatedData: Record<number, AggregatedUnemploymentData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: (CodeYearResolver & LadResolver) | undefined,
): AggregatedUnemploymentData | null {
	if (selectedArea === null) {
		const agg = aggregatedData?.[dataset.latestYear] ?? null;
		if (!agg) return null;
		return agg;
	}

	const fromRecord = (code: string) => {
		const r =
			dataset.data[code] ??
			dataset.data[
				codeMapper?.getCodeForYear(
					"localAuthority",
					code,
					dataset.boundaryYear,
				) ?? ""
			];
		if (!r) return null;
		const rates: Record<number, number> = {};
		const levels: Record<number, number> = {};
		for (const yr of dataset.years) {
			const v = r.rates[yr];
			const level = r.levels?.[yr];
			if (v != null) rates[yr] = v;
			if (level != null) levels[yr] = level;
		}
		return {
			years: dataset.years,
			latestYear: dataset.latestYear,
			rates,
			levels,
		};
	};

	const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
	return ladCode ? fromRecord(ladCode) : null;
}

function buildSparkline(
	stats: AggregatedUnemploymentData,
	measure: "rate" | "count",
): {
	linePath: string;
	areaPath: string;
	lastPt: { x: number; y: number };
} | null {
	const points = stats.years
		.map((yr) => ({
			yr,
			v: stats[measure === "rate" ? "rates" : "levels"][yr],
		}))
		.filter((p): p is { yr: number; v: number } => p.v != null);

	if (points.length < 2) return null;

	const W = 100,
		H = 100;
	const PAD_Y = 12; // keep line away from top/bottom edges

	const values = points.map((p) => p.v);
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
	const measure = useCurrentMapOptions().unemployment.measure;
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive =
		activeDataset?.type === "unemployment" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const sparkline = stats ? buildSparkline(stats, measure) : null;

	if (!dataset) return null;

	const latestValue =
		stats?.[measure === "rate" ? "rates" : "levels"][dataset.latestYear];

	return (
		<ChartCard
			heading={`Historic Unemployment ${measure === "rate" ? "Rate" : "Count"} [1996-${dataset.latestYear}]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, hasData)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={hasData ? ACCENT : null}
			isActive={isActive}
			title="ONS. Final model-based unemployment estimates for local and unitary authorities; this series was discontinued in August 2022. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.latestYear,
				})
			}
			background={
				sparkline && (
					<svg
						className="absolute inset-0 size-full"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
					>
						<defs>
							<linearGradient
								id="unemployment-area-gradient"
								x1="0%"
								y1="0%"
								x2="0%"
								y2="100%"
							>
								<stop
									offset="0%"
									stopColor={LINE_COLOR}
									stopOpacity={isDark ? 0.2 : 0.12}
								/>
								<stop
									offset="80%"
									stopColor={LINE_COLOR}
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<path
							d={sparkline.areaPath}
							fill="url(#unemployment-area-gradient)"
						/>
						<path
							d={sparkline.linePath}
							fill="none"
							stroke={LINE_COLOR}
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
						/>
						<circle
							cx={sparkline.lastPt.x}
							cy={sparkline.lastPt.y}
							r="2"
							fill={LINE_COLOR}
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				)
			}
		>
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
				<div className="relative z-10 flex items-end justify-between gap-1.5 flex-1">
					<div
						className={`text-2xl font-bold leading-none ${isDark ? "text-gray-100" : "text-gray-800"}`}
					>
						{latestValue != null
							? measure === "rate"
								? latestValue.toFixed(1)
								: latestValue.toLocaleString()
							: "—"}
						<span
							className={`text-[10px] font-normal ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{measure === "rate" ? "%" : " unemployed"} (
							{dataset.latestYear})
						</span>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
