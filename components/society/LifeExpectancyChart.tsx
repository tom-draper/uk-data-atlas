"use client";
import {
	ActiveViz,
	AggregatedLifeExpectancyData,
	Dataset,
	LifeExpectancyDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo } from "react";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";

interface LifeExpectancyChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LifeExpectancyDataset>;
	aggregatedData: Record<string, AggregatedLifeExpectancyData> | null;
	selectedArea: SelectedArea | null;
	datasetId: string;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function leBar(years: number, label: string, min: number, max: number) {
	const pct = Math.max(0, Math.min(100, ((years - min) / (max - min)) * 100));
	return (
		<div className="flex items-center gap-1.5">
			<span className="text-[10px] text-gray-400/80 w-3">{label}</span>
			<div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
				<div
					className="h-full rounded-full bg-teal-500/70"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-[10px] font-semibold text-gray-600 w-8 text-right">
				{years.toFixed(1)}
			</span>
		</div>
	);
}

export default memo(function LifeExpectancyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	datasetId,
	activeViz,
	setActiveViz,
}: LifeExpectancyChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[datasetId];

	const leStats = useMemo(() => {
		if (!dataset || chartsLoading) return null;

		if (selectedArea === null) {
			if (aggregatedData?.[datasetId]) return aggregatedData[datasetId];
			return null;
		}

		if (selectedArea.type === "localAuthority") {
			const record = dataset.data[selectedArea.code];
			return record
				? { averageMaleLE: record.maleBirthLE, averageFemaleLE: record.femaleBirthLE }
				: null;
		}

		if (selectedArea.type === "ward" && selectedArea.data) {
			const record = dataset.data[selectedArea.data.ladCode];
			return record
				? { averageMaleLE: record.maleBirthLE, averageFemaleLE: record.femaleBirthLE }
				: null;
		}

		return null;
	}, [dataset, aggregatedData, datasetId, selectedArea, chartsLoading]);

	const barRange = useMemo(() => {
		if (!dataset || chartsLoading) return { min: 55, max: 85 };
		const vals = Object.values(dataset.data).flatMap((r) => [r.maleBirthLE, r.femaleBirthLE]);
		return { min: Math.min(...vals), max: Math.max(...vals) };
	}, [dataset, chartsLoading]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "lifeExpectancy" && activeDataset.id === dataset.id;

	return (
		<div
			className={`p-2 rounded cursor-pointer overflow-hidden relative h-20 ${
				isActive
					? `border-2 border-amber-400 ${isDark ? "bg-white/10" : "bg-amber-50/60"}`
					: isDark ? "bg-white/5 border-2 border-white/10 hover:border-amber-400" : "bg-white/60 border-2 border-gray-200/80 hover:border-amber-400"
			}`}
			title={dataset.metadata.source}
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
					{dataset.label} [{dataset.dataPeriod}]
				</h3>
				{leStats ? (
					<div className="mt-1.5 space-y-1">
						{leBar(leStats.averageMaleLE, "M", barRange.min, barRange.max)}
						{leBar(leStats.averageFemaleLE, "F", barRange.min, barRange.max)}
					</div>
				) : (
					<div className="h-5 mt-2 mb-2">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full" />
						) : (
							<div className="text-xs text-gray-400/80 pt-0.5 text-center">
								No data available
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
});
