"use client";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitLADDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { LocalAuthorityEstimateIndicator } from "@/components/LocalAuthorityEstimateIndicator";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	selectedAreaLadRecord,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";

interface BrexitChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitLADDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: LadResolver;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const LEAVE_COLOR = "#b41414"; // rgb(180, 20, 20) — matches bar fill
const REMAIN_COLOR = "#1e3cb4"; // rgb(30, 60, 180) — matches bar fill

export function resolveBrexitElectoralStats(
	dataset: BrexitLADDataset,
	aggregatedData: Record<number, AggregatedBrexitData> | null,
	selectedArea: SelectedArea | null,
	codeMapper?: LadResolver,
) {
	if (
		selectedArea === null &&
		aggregatedData &&
		aggregatedData[dataset.year]
	) {
		const agg = aggregatedData[dataset.year];
		return {
			pctLeave: agg.pctLeave,
			pctRemain: agg.pctRemain,
			totalLeave: agg.totalLeave,
			totalRemain: agg.totalRemain,
			totalVotes: agg.totalVotes,
		};
	}

	if (selectedArea) {
		const area = selectedAreaLadRecord(
			dataset.data,
			selectedArea,
			codeMapper,
			dataset.boundaryYear,
		);
		if (area) {
			return {
				pctLeave: area.pctLeave,
				pctRemain: area.pctRemain,
				totalLeave: area.leave,
				totalRemain: area.remain,
				totalVotes: area.validVotes,
			};
		}
	}

	return null;
}

export default function BrexitElectoralChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	activeViz,
	setActiveViz,
}: BrexitChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const brexitStats = dataset
		? resolveBrexitElectoralStats(
				dataset,
				aggregatedData,
				selectedArea,
				codeMapper,
			)
		: null;

	const isActive = !!(
		activeDataset?.type === "brexit" &&
		activeDataset.id === (dataset?.id ?? `brexit${year}`)
	);

	const pctLeave = brexitStats?.pctLeave ?? 0;
	const pctRemain = brexitStats?.pctRemain ?? 0;
	const hasData = brexitStats !== null;

	const result = hasData ? (pctLeave > pctRemain ? "leave" : "remain") : null;
	const accentColor =
		result === "leave"
			? LEAVE_COLOR
			: result === "remain"
				? REMAIN_COLOR
				: null;
	return (
		<ChartCard
			heading={`Electoral Commission [${dataset?.year ?? year}]`}
			headerEnd={
				<LocalAuthorityEstimateIndicator
					selectedArea={selectedArea}
					hasData={hasData}
					isDark={isDark}
				/>
			}
			accent={accentColor}
			isActive={isActive}
			minHeightClassName="min-h-[65px]"
			title="Electoral Commission. EU Referendum Results, 2016. electoralcommission.org.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset?.id ?? `brexit${year}`,
					datasetType: "brexit",
					datasetYear: dataset?.year ?? year,
				})
			}
		>
			{!hasData ? (
				chartsLoading ? (
					<ChartContentPlaceholder className="h-5" />
				) : (
					<div
						className={`h-5 flex items-center justify-center text-xs ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
					>
						No data available
					</div>
				)
			) : (
				<div className="flex h-5 rounded overflow-hidden">
					<div
						style={{
							width: `${pctLeave.toFixed(1)}%`,
							backgroundColor: `rgb(180, 20, 20)`,
						}}
					>
						{pctLeave > 20 && (
							<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
								Leave {pctLeave.toFixed(1)}%
							</span>
						)}
					</div>
					<div
						style={{
							width: `${pctRemain.toFixed(1)}%`,
							backgroundColor: `rgb(30, 60, 180)`,
						}}
					>
						{pctRemain > 20 && (
							<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
								Remain {pctRemain.toFixed(1)}%
							</span>
						)}
					</div>
				</div>
			)}
		</ChartCard>
	);
}
