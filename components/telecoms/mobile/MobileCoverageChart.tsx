"use client";
import {
	ActiveViz,
	AggregatedMobileCoverageData,
	Dataset,
	MobileCoverageDataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartDataPlaceholder } from "@/components/ChartDataPlaceholder";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { MOBILE_COVERAGE_MEASURES } from "@/lib/helpers/mobileCoverageMeasures";
import { MetricPill } from "@/components/MetricPill";
import { useIsDark } from "@/lib/context/ThemeContext";
import { localAuthorityStats } from "@/lib/helpers/localAuthorityStats";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";

interface MobileCoverageChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, MobileCoverageDataset>;
	aggregatedData: Record<number, AggregatedMobileCoverageData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#8b5cf6";

// Half the country sits below a third of premises on all four networks, so the
// bands are set against that spread rather than against 100%.
function coverageColor(share: number): string {
	if (share >= 75) return "#22c55e";
	if (share >= 40) return "#eab308";
	if (share >= 10) return "#f97316";
	return "#ef4444";
}

export default function MobileCoverageChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: MobileCoverageChartProps) {
	const isDark = useIsDark();
	const measure = useCurrentMapOptions().mobileCoverage.measure;
	const measureLabel = MOBILE_COVERAGE_MEASURES.find(
		({ value }) => value === measure,
	)!.label;
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? localAuthorityStats(
				dataset,
				aggregatedData,
				selectedArea,
				codeMapper,
				(record) => ({
					pct4GIndoorAll: record.pct4GIndoorAll,
					pct4GIndoorAny: record.pct4GIndoorAny,
					pct5GOutdoorAll: record.pct5GOutdoorAll,
					pct5GOutdoorAny: record.pct5GOutdoorAny,
					pct4GGeoAll: record.pct4GGeoAll,
					pct5GGeoAny: record.pct5GGeoAny,
				}),
			)
		: null;

	const isActive =
		activeDataset?.type === "mobileCoverage" &&
		activeDataset.id === dataset?.id;

	if (!dataset) return null;

	const coverage = stats?.[measure] ?? null;
	const color = coverage != null ? coverageColor(coverage) : null;

	return (
		<ChartCard
			heading={`Mobile Coverage [${dataset.year}]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, stats !== null)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={stats ? ACCENT : null}
			isActive={isActive}
			title="Ofcom. Connected Nations, mobile coverage. ofcom.org.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			{!stats ? (
				<ChartDataPlaceholder />
			) : (
				<div className="flex items-end justify-between gap-1.5 flex-1">
					<div className="flex flex-col gap-0.5">
						<div className="flex items-baseline gap-1">
							<span
								className="text-2xl font-bold leading-none"
								style={{ color: color ?? undefined }}
							>
								{coverage != null ? coverage.toFixed(1) : "—"}
							</span>
							<span
								className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								% {measureLabel}
							</span>
						</div>
						<span
							className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{stats.pct5GOutdoorAny != null
								? measure.includes("Geo")
									? "Regional landmass figures are authority means"
									: `${stats.pct5GOutdoorAny.toFixed(1)}% 5G on at least one`
								: "—"}
						</span>
					</div>
					<div className="flex gap-1 shrink-0">
						<MetricPill
							label="4G in"
							value={stats.pct4GIndoorAll}
							unit="%"
						/>
						<MetricPill
							label="4G land"
							value={stats.pct4GGeoAll}
							unit="%"
						/>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
