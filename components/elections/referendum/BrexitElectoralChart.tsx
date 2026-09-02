"use client";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitLADDataset,
	SelectedArea,
} from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

interface BrexitChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitLADDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const LEAVE_COLOR = "#b41414"; // rgb(180, 20, 20) — matches bar fill
const REMAIN_COLOR = "#1e3cb4"; // rgb(30, 60, 180) — matches bar fill

function computeBrexitElectoralStats(
	dataset: BrexitLADDataset,
	aggregatedData: Record<number, AggregatedBrexitData> | null,
	selectedArea: SelectedArea | null,
	codeMapper: CodeMapper | undefined,
	year: number,
) {
	if (selectedArea === null && aggregatedData && aggregatedData[dataset.year]) {
		const agg = aggregatedData[dataset.year];
		return {
			pctLeave: agg.pctLeave,
			pctRemain: agg.pctRemain,
			totalLeave: agg.totalLeave,
			totalRemain: agg.totalRemain,
			totalVotes: agg.totalVotes,
		};
	}

	if (selectedArea && selectedArea.type === "localAuthority" && selectedArea.data) {
		const laCode = selectedArea.code;
		let area = dataset.data?.[laCode];
		if (!area && codeMapper) {
			const mappedCode = codeMapper.getCodeForYear("localAuthority", laCode, year);
			if (mappedCode) {
				area = dataset.data?.[mappedCode];
			}
		}
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

	const brexitStats = dataset ? computeBrexitElectoralStats(dataset, aggregatedData, selectedArea, codeMapper, year) : null;

	const isActive = !!(dataset && activeDataset?.type === "brexit" && activeDataset.id === dataset.id);

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
	if (!dataset) return null;

	return (
		<ChartCard
			heading={`Electoral Commission [${dataset.year}]`}
			accent={accentColor}
			isActive={isActive}
			minHeightClassName="min-h-[65px]"
			title="Electoral Commission. EU Referendum Results, 2016. electoralcommission.org.uk"
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
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
