"use client";

import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
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
import { SparklineBackground } from "@/components/measures/SparklineBackground";
import { sparkline } from "@/lib/measures/series";
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
) {
	const source = stats[measure === "rate" ? "rates" : "levels"];
	return sparkline(
		stats.years.flatMap((yr) => (source[yr] != null ? [source[yr]] : [])),
		{ margin: 0.3, padY: 12 },
	);
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
	const measure =
		useCurrentMapOptions().unemployment.measure === "count"
			? "count"
			: "rate";
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea, codeMapper)
		: null;

	const isActive =
		activeDataset?.type === "unemployment" &&
		activeDataset.id === dataset?.id;
	const hasData = stats !== null;
	const line = stats ? buildSparkline(stats, measure) : null;

	if (!dataset) return null;

	const latestValue =
		stats?.[measure === "rate" ? "rates" : "levels"][dataset.latestYear];

	return (
		<ChartCard
			coverage={formatDatasetCoverage(dataset)}
			heading={`Historic Unemployment [1996-${dataset.latestYear}]`}
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
				line && (
					<SparklineBackground
						sparkline={line}
						color={LINE_COLOR}
						gradientId="unemployment-area-gradient"
						fade={[
							{ offset: "0%", opacity: isDark ? 0.2 : 0.12 },
							{ offset: "80%", opacity: 0 },
						]}
						strokeWidth={1.5}
						marker
					/>
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
