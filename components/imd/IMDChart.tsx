"use client";
import {
	ActiveViz,
	AggregatedIMDData,
	Dataset,
	IMDDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
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

interface IMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IMDDataset>;
	aggregatedData: Record<number, AggregatedIMDData> | null;
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

export default memo(function IMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	activeViz,
	setActiveViz,
}: IMDChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const imdStats = useMemo(() => {
		if (!dataset || chartsLoading) return null;

		const avgFromRecords = (records: (typeof dataset.data)[string][]) => {
			if (records.length === 0) return null;
			return {
				averageIMDScore:
					records.reduce((s, r) => s + r.imdScore, 0) /
					records.length,
				averageIMDDecile:
					records.reduce((s, r) => s + r.imdDecile, 0) /
					records.length,
			};
		};

		// Global view — wait for boundary-aggregated data instead of averaging all records during load.
		if (selectedArea === null) {
			if (aggregatedData && aggregatedData[dataset.year]) {
				return aggregatedData[dataset.year];
			}
			return null;
		}

		// Local authority selected
		if (selectedArea.type === "localAuthority") {
			const ladCode = selectedArea.code;
			return avgFromRecords(
				Object.values(dataset.data).filter(
					(r) => r.ladCode === ladCode,
				),
			);
		}

		// Ward selected — look up via parent LAD code stored on the ward data
		if (selectedArea.type === "ward" && selectedArea.data) {
			const ladCode = selectedArea.data.ladCode;
			return avgFromRecords(
				Object.values(dataset.data).filter(
					(r) => r.ladCode === ladCode,
				),
			);
		}

		// LSOA selected — direct lookup by code
		if (selectedArea.type === "lsoa") {
			const record = dataset.data[selectedArea.code];
			return record
				? {
						averageIMDScore: record.imdScore,
						averageIMDDecile: record.imdDecile,
					}
				: null;
		}

		// Constituency — no direct mapping
		return null;
	}, [dataset, aggregatedData, selectedArea, chartsLoading]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "imd" && activeDataset.id === dataset.id;

	const decile = imdStats ? Math.round(imdStats.averageIMDDecile) : null;
	const decileColor = decile ? DECILE_COLORS[decile - 1] : "#9ca3af";
	const hasData = imdStats !== null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? decileColor : null,
		isActive,
		isDark,
	);

	return (
		<div
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title="Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk"
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
					Deprivation (IMD) [{dataset.year}]
				</h3>
				{hasData && imdStats ? (
					<div className="mt-0 flex items-start gap-2.5">
						<div className="shrink-0 w-7 text-right leading-none pt-0.5">
							<span
								className="text-2xl font-bold"
								style={{ color: decileColor }}
							>
								{decile}
							</span>
						</div>
						<div className="flex-1 flex flex-col gap-1 pt-2">
							<div className="flex gap-[2px]">
								{DECILE_COLORS.map((color, i) => (
									<div
										key={i}
										className="flex-1 h-5 rounded-[2px]"
										style={{
											backgroundColor:
												decile === i + 1
													? color
													: isDark
														? "rgba(255,255,255,0.1)"
														: "rgba(0,0,0,0.08)",
										}}
									/>
								))}
							</div>
							<div className="flex justify-between">
								<span
									className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
								>
									most deprived
								</span>
								<span
									className={`text-[9px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
								>
									Score {imdStats.averageIMDScore.toFixed(1)}
								</span>
							</div>
						</div>
					</div>
				) : (
					<div className="h-12 flex items-center justify-center">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full w-full" />
						) : (
							<div
								className={`text-xs pb-2 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
							>
								No data available
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
});
