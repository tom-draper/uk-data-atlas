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
	"#67000d", // 1 - most deprived
	"#a50026",
	"#d73027",
	"#f46d43",
	"#fdae61",
	"#fee090",
	"#e0f3f8",
	"#abd9e9",
	"#74add1",
	"#313695", // 10 - least deprived
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

		const avgFromRecords = (records: typeof dataset.data[string][]) => {
			if (records.length === 0) return null;
			return {
				averageIMDScore: records.reduce((s, r) => s + r.imdScore, 0) / records.length,
				averageIMDDecile: records.reduce((s, r) => s + r.imdDecile, 0) / records.length,
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
			return avgFromRecords(Object.values(dataset.data).filter((r) => r.ladCode === ladCode));
		}

		// Ward selected — look up via parent LAD code stored on the ward data
		if (selectedArea.type === "ward" && selectedArea.data) {
			const ladCode = selectedArea.data.ladCode;
			return avgFromRecords(Object.values(dataset.data).filter((r) => r.ladCode === ladCode));
		}

		// LSOA selected — direct lookup by code
		if (selectedArea.type === "lsoa") {
			const record = dataset.data[selectedArea.code];
			return record ? { averageIMDScore: record.imdScore, averageIMDDecile: record.imdDecile } : null;
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

	return (
		<div
			className={`p-2 rounded cursor-pointer overflow-hidden relative h-20 ${
				isActive
					? `border-2 border-amber-400 ${isDark ? "bg-white/10" : "bg-amber-50/60"}`
					: isDark ? "bg-white/5 border-2 border-white/10 hover:border-amber-400" : "bg-white/60 border-2 border-gray-200/80 hover:border-amber-400"
			}`}
			title="Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk"
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
				<h3 className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800/90"}`}>
					Deprivation (IMD) [{dataset.year}]
				</h3>
				{hasData && imdStats ? (
					<div className="mt-1.5 flex items-center gap-2">
						<div className="flex gap-0.5 flex-1">
							{DECILE_COLORS.map((color, i) => (
								<div
									key={i}
									className="flex-1 h-3 rounded-sm"
									style={{
										backgroundColor: color,
										opacity: decile === i + 1 ? 1 : 0.25,
									}}
								/>
							))}
						</div>
					</div>
				) : (
					<div className="h-5 mt-2 mb-2">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full" />
						) : (
							<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
								No data available
							</div>
						)}
					</div>
				)}
				{hasData && imdStats && (
					<div className="mt-1 flex justify-between items-baseline">
						<span className="text-xs font-semibold" style={{ color: decileColor }}>
							{decile !== null ? `Decile ${decile}` : ""}
						</span>
						<span className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
							Score {imdStats.averageIMDScore.toFixed(1)}
						</span>
					</div>
				)}
			</div>
		</div>
	);
});
