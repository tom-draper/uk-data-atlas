"use client";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitLADDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useCardAccent, cardClass, chartHeadingClass } from "@/lib/hooks/useCardAccent";

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

export default memo(function BrexitElectoralChart({
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

	const result = hasData ? (pctLeave > pctRemain ? "leave" : "remain") : null;
	const accentColor = result === "leave" ? LEAVE_COLOR : result === "remain" ? REMAIN_COLOR : null;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(accentColor, isActive, isDark);

	return (
		<div
			style={style}
			className={cardClass(isActive, isDark, "h-[65px]")}
			title="Electoral Commission. EU Referendum Results, 2016. electoralcommission.org.uk"
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
			<div className="relative z-10">
				<h3 className={chartHeadingClass(isDark)}>
					Electoral Commission [{dataset.year}]
				</h3>

				{!hasData ? (
					chartsLoading ? (
						<ChartContentPlaceholder className="h-5 mt-2" />
					) : (
						<div className={`mt-2 h-5 flex items-center justify-center text-xs ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)
				) : (
					<div className="mt-2 flex h-5 rounded overflow-hidden">
						<div style={{ width: `${pctLeave.toFixed(1)}%`, backgroundColor: `rgb(180, 20, 20)` }}>
							{pctLeave > 20 && (
								<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
									Leave {pctLeave.toFixed(1)}%
								</span>
							)}
						</div>
						<div style={{ width: `${pctRemain.toFixed(1)}%`, backgroundColor: `rgb(30, 60, 180)` }}>
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
