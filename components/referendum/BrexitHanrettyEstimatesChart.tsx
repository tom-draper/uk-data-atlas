"use client";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitConstituencyDataset,
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

interface BrexitHanrettyEstimatesChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitConstituencyDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const LEAVE_COLOR = "#b41414"; // rgb(180, 20, 20) — matches bar fill
const REMAIN_COLOR = "#1e3cb4"; // rgb(30, 60, 180) — matches bar fill

export default memo(function BrexitHanrettyEstimatesChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	activeViz,
	setActiveViz,
}: BrexitHanrettyEstimatesChartProps) {
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
			};
		}

		if (
			selectedArea &&
			selectedArea.type === "constituency" &&
			selectedArea.data
		) {
			const code = selectedArea.code;
			const area = dataset.data?.[code];
			if (area) {
				return {
					pctLeave: area.pctLeave,
					pctRemain: 100 - area.pctLeave,
				};
			}
		}

		return null;
	}, [dataset, aggregatedData, selectedArea, year]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "brexitConstituency" &&
		activeDataset.id === dataset.id;

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
			title="Hanretty, C. (2017). Areal interpolation and the UK's referendum on EU membership. Journal of Elections, Public Opinion and Parties, 27(4), 466–483. Published via House of Commons Library."
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
					Hanretty Estimates [{dataset.year}]
				</h3>

				{!hasData ? (
					chartsLoading ? (
						<ChartContentPlaceholder className="h-5 mt-2" />
					) : (
						<div className={`mt-1.5 h-5 flex items-center justify-center text-xs ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)
				) : (
					<div className="mt-1.5 flex h-5 rounded overflow-hidden">
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
