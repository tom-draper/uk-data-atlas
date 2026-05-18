"use client";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";

interface BrexitChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function BrexitHanrettyEstimatesChart({
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
	const dataset = availableDatasets?.[year];

	const brexitStats = useMemo(() => {
		if (!dataset) return null;

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

		if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			selectedArea.data
		) {
			const laCode = selectedArea.code;
			let area = dataset.data?.[laCode];
			if (!area && codeMapper) {
				const mappedCode = codeMapper.getCodeForYear(
					"localAuthority",
					laCode,
					year,
				);
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
	}, [dataset, aggregatedData, selectedArea, codeMapper, year]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "brexit" && activeDataset.id === dataset.id;

	const pctLeave = brexitStats?.pctLeave ?? 0;
	const pctRemain = brexitStats?.pctRemain ?? 0;
	const hasData = brexitStats !== null;

	// Determine result
	const result = hasData ? (pctLeave > pctRemain ? "leave" : "remain") : null;

	const leaveBgColor = "rgb(180, 20, 20)";
	const remainBgColor = "rgb(30, 60, 180)";

	const activeBorderClass = isActive
		? result === "leave"
			? "border-red-400"
			: "border-blue-400"
		: result === "leave"
			? "hover:border-red-400"
			: "hover:border-blue-400";

	return (
		<div
			className={`p-2 rounded cursor-pointer overflow-hidden relative h-[65px] ${
				isActive
					? result === "leave"
						? "bg-red-50/60 border-2 border-red-400"
						: "bg-blue-50/60 border-2 border-blue-400"
					: `bg-white/60 border-2 border-gray-200/80 ${activeBorderClass}`
			}`}
			title="Electoral Commission. EU Referendum Results, 2016. electoralcommission.org.uk"
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="relative z-10">
				<h3 className="text-xs font-bold text-gray-800/90">
					Electoral Commission [{dataset.year}]
				</h3>

				{!hasData ? (
					chartsLoading ? (
						<ChartContentPlaceholder className="h-5 mt-2" />
					) : (
						<div className="mt-2 h-5 flex items-center justify-center text-xs text-gray-400/80">
							No data available
						</div>
					)
				) : (
					<div className="mt-2 flex h-5 rounded overflow-hidden">
						<div style={{ width: `${pctLeave.toFixed(1)}%`, backgroundColor: leaveBgColor }}>
							{pctLeave > 20 && (
								<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
									Leave {pctLeave.toFixed(1)}%
								</span>
							)}
						</div>
						<div style={{ width: `${pctRemain.toFixed(1)}%`, backgroundColor: remainBgColor }}>
							{pctRemain > 20 && (
								<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
									Remain {pctRemain.toFixed(1)}%
								</span>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
});
