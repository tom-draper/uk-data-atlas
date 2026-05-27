"use client";
import {
	ActiveViz,
	AggregatedWIMDData,
	Dataset,
	WIMDDataset,
	SelectedArea,
} from "@lib/types";


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

interface WIMDChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, WIMDDataset>;
	aggregatedData: Record<number, AggregatedWIMDData> | null;
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

export default function WIMDChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: WIMDChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const wimdStats = (() => {
		if (!dataset || chartsLoading) return null;

		const avgFromRecords = (records: (typeof dataset.data)[string][]) => {
			if (records.length === 0) return null;
			return {
				averageWIMDScore:
					records.reduce((s, r) => s + r.wimdScore, 0) /
					records.length,
				averageWIMDDecile:
					records.reduce((s, r) => s + r.wimdDecile, 0) /
					records.length,
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
			return avgFromRecords(
				Object.values(dataset.data).filter(
					(r) => r.ladCode === ladCode,
				),
			);
		}

		if (selectedArea.type === "ward" && selectedArea.data) {
			const ladCode = selectedArea.data.ladCode;
			return avgFromRecords(
				Object.values(dataset.data).filter(
					(r) => r.ladCode === ladCode,
				),
			);
		}

		if (selectedArea.type === "lsoa") {
			const record = dataset.data[selectedArea.code];
			return record
				? {
						averageWIMDScore: record.wimdScore,
						averageWIMDDecile: record.wimdDecile,
					}
				: null;
		}

		return null;
	})();

	const isActive =
		activeDataset?.type === "wimd" && activeDataset.id === dataset?.id;

	const decile = wimdStats ? Math.round(wimdStats.averageWIMDDecile) : null;
	const decileColor = decile ? DECILE_COLORS[decile - 1] : "#9ca3af";
	const hasData = wimdStats !== null;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		hasData ? decileColor : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "h-20 block w-full text-left")}
			title="Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales"
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
					Deprivation (WIMD) [{dataset.year}]
				</h3>
				{hasData && wimdStats ? (
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
									Wales only
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
		</button>
	);
}
