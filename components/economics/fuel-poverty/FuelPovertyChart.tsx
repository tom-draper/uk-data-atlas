"use client";
import { ActiveViz, AggregatedFuelPovertyData, Dataset, FuelPovertyDataset, SelectedArea } from "@lib/types";
import { ChartContentPlaceholder, ChartLoadingBackground, useChartsLoading } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { cardClass, chartHeadingClass, useCardAccent } from "@/lib/hooks/useCardAccent";

interface Props {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, FuelPovertyDataset>;
	aggregatedData: Record<number, AggregatedFuelPovertyData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const colorForRate = (rate: number) => rate >= 15 ? "#dc2626" : rate >= 10 ? "#f97316" : rate >= 7 ? "#eab308" : "#16a34a";
const formatCount = (count: number) => count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}m` : `${Math.round(count / 1_000)}k`;

export default function FuelPovertyChart({ activeDataset, availableDatasets, aggregatedData, selectedArea, setActiveViz }: Props) {
	const dataset = availableDatasets[2024];
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const record = dataset && selectedArea?.type === "lsoa" ? dataset.data[selectedArea.code] : null;
	const stats = record ? { fuelPovertyRate: record.fuelPovertyRate, fuelPoorHouseholdCount: record.fuelPoorHouseholdCount } : dataset ? aggregatedData?.[dataset.year] ?? null : null;
	const active = activeDataset?.type === "fuelPoverty" && activeDataset.id === dataset?.id;
	const accent = stats ? colorForRate(stats.fuelPovertyRate) : null;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(accent, active, isDark);
	if (!dataset) return null;
	return <button type="button" style={style} className={cardClass(active, isDark, "h-20")} title="DESNZ. Fuel poverty (LILEE), England, 2024." onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={() => setActiveViz({ vizId: dataset.id, datasetType: dataset.type, datasetYear: dataset.year })}>
		<ChartLoadingBackground />
		<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0"><h3 className={chartHeadingClass(isDark)}>Fuel Poverty [2024]</h3></div>
		{!stats ? <div className="flex-1 mt-1">{chartsLoading ? <ChartContentPlaceholder className="h-full" /> : <div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>No data available</div>}</div> : <div className="flex-1 flex flex-col gap-1"><div className="flex items-baseline justify-between"><div className="leading-none"><span className="text-2xl font-bold leading-none" style={{ color: accent! }}>{stats.fuelPovertyRate.toFixed(1)}</span><span className={`text-[10px] ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>%</span></div><span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{formatCount(stats.fuelPoorHouseholdCount)} households</span></div><div className={`text-[9px] leading-none ${isDark ? "text-gray-500" : "text-gray-400"}`}>Low income, low energy efficiency</div></div>}
	</button>;
}
