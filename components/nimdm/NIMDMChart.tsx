"use client";
import {
	ActiveViz,
	AggregatedNIMDMData,
	Dataset,
	NIMDMDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useCardAccent, cardClass, chartHeadingClass } from "@/lib/hooks/useCardAccent";

interface NIMDMChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, NIMDMDataset>;
	aggregatedData: Record<number, AggregatedNIMDMData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const DECILE_COLORS = [
	"#dc2626", // 1 - most deprived
	"#ef4444", // 2
	"#f97316", // 3
	"#f59e0b", // 4
	"#eab308", // 5
	"#a3e635", // 6
	"#4ade80", // 7
	"#22c55e", // 8
	"#16a34a", // 9
	"#15803d", // 10 - least deprived
];

export default memo(function NIMDMChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: NIMDMChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const nimdmStats = useMemo(() => {
		if (!dataset || chartsLoading) return null;

		const avgFromRecords = (records: typeof dataset.data[string][]) => {
			if (records.length === 0) return null;
			return {
				averageNIMDMScore: records.reduce((s, r) => s + r.nimdmScore, 0) / records.length,
				averageNIMDMDecile: records.reduce((s, r) => s + r.nimdmDecile, 0) / records.length,
			};
		};

		if (selectedArea === null) {
			if (aggregatedData && aggregatedData[dataset.year]) {
				return aggregatedData[dataset.year];
			}
			return null;
		}

		if (selectedArea.type === "localAuthority") {
			const ladCode = selectedArea.code;
			return avgFromRecords(Object.values(dataset.data).filter((r) => r.lgdCode === ladCode));
		}

		if (selectedArea.type === "ward" && selectedArea.data) {
			const ladCode = selectedArea.data.ladCode;
			return avgFromRecords(Object.values(dataset.data).filter((r) => r.lgdCode === ladCode));
		}

		return null;
	}, [dataset, aggregatedData, selectedArea, chartsLoading]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "nimdm" && activeDataset.id === dataset.id;

	const decile = nimdmStats ? Math.round(nimdmStats.averageNIMDMDecile) : null;
	const decileColor = decile ? DECILE_COLORS[decile - 1] : "#9ca3af";
	const hasData = nimdmStats !== null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(hasData ? decileColor : null, isActive, isDark);

	return (
		<div
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="NISRA. Northern Ireland Multiple Deprivation Measure 2017. nisra.gov.uk"
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
					Deprivation (NIMDM) [{dataset.year}]
				</h3>
				{hasData && nimdmStats ? (
					<div className="mt-0 flex items-start gap-2.5">
						<div className="shrink-0 w-7 text-right leading-none pt-0.5">
							<span className="text-2xl font-bold" style={{ color: decileColor }}>{decile}</span>
						</div>
						<div className="flex-1 flex flex-col gap-1 pt-2">
							<div className="flex gap-[2px]">
								{DECILE_COLORS.map((color, i) => (
									<div
										key={i}
										className="flex-1 h-5 rounded-[2px]"
										style={{
											backgroundColor: decile === i + 1 ? color : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
										}}
									/>
								))}
							</div>
							<div className="flex justify-between">
								<span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>most deprived</span>
								<span className={`text-[9px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>N. Ireland only</span>
							</div>
						</div>
					</div>
				) : (
					<div className="h-12 flex items-center justify-center">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full w-full" />
						) : (
							<div className={`text-xs pb-2 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
								No data available
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
});
