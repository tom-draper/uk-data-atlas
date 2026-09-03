"use client";
import {
	ActiveViz,
	AggregatedFuelPovertyData,
	Dataset,
	FuelPovertyDataset,
	SelectedArea,
} from "@lib/types";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useIsDark } from "@/lib/context/ThemeContext";

interface Props {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, FuelPovertyDataset>;
	aggregatedData: Record<number, AggregatedFuelPovertyData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const colorForRate = (rate: number) =>
	rate >= 15
		? "#dc2626"
		: rate >= 10
			? "#f97316"
			: rate >= 7
				? "#eab308"
				: "#16a34a";
const formatCount = (count: number) =>
	count >= 1_000_000
		? `${(count / 1_000_000).toFixed(1)}m`
		: `${Math.round(count / 1_000)}k`;

export default function FuelPovertyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: Props) {
	const dataset = availableDatasets[year];
	const isDark = useIsDark();
	const record =
		dataset && selectedArea?.type === "lsoa"
			? dataset.data[selectedArea.code]
			: null;
	const stats = record
		? {
				fuelPovertyRate: record.fuelPovertyRate,
				fuelPoorHouseholdCount: record.fuelPoorHouseholdCount,
			}
		: dataset
			? (aggregatedData?.[dataset.year] ?? null)
			: null;
	const active =
		activeDataset?.type === "fuelPoverty" &&
		activeDataset.id === dataset?.id;
	const accent = stats ? colorForRate(stats.fuelPovertyRate) : null;
	if (!dataset) return null;
	const barWidth = (Math.min(stats?.fuelPovertyRate ?? 0, 20) / 20) * 100;
	return (
		<ChartCard
			heading="Fuel Poverty [2024]"
			headerEnd={
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
					England
				</span>
			}
			accent={accent}
			isActive={active}
			title="DESNZ. Fuel poverty (LILEE), England, 2024."
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={stats !== null}
				value={stats?.fuelPovertyRate.toFixed(1) ?? ""}
				unit="% households"
				secondary={
					stats
						? `${formatCount(stats.fuelPoorHouseholdCount)} affected`
						: undefined
				}
				barWidth={barWidth}
				barColor={accent ?? undefined}
			/>
		</ChartCard>
	);
}
