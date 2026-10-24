"use client";

import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { useEffect, useMemo, useState } from "react";
import {
	ActiveViz,
	AggregatedFuelPovertyData,
	Dataset,
	FuelPovertyDataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import { fetchLsoaToLad } from "@/lib/data/boundaries/lsoaLadMappings";
import { aggregateFuelPovertyByLad } from "@/lib/helpers/fuelPoverty";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";

interface Props {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, FuelPovertyDataset>;
	aggregatedData: Record<number, AggregatedFuelPovertyData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

const formatCount = (count: number) =>
	count >= 1_000_000
		? `${(count / 1_000_000).toFixed(1)}m`
		: `${Math.round(count / 1_000)}k`;

/**
 * Fuel-poverty estimates are published at LSOA level. A location aggregate is
 * useful before a feature is hovered. Wards are resolved to their parent local
 * authority and shown as a household-weighted LSOA summary, never as a ward
 * estimate.
 */
export function resolveFuelPovertyStats(
	dataset: FuelPovertyDataset,
	aggregatedData: Record<number, AggregatedFuelPovertyData> | null,
	selectedArea: SelectedArea | null,
	ladStats: Record<string, AggregatedFuelPovertyData> | null,
	codeMapper?: LadResolver,
): AggregatedFuelPovertyData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;
	if (selectedArea.type === "lsoa")
		return dataset.data[selectedArea.code] ?? null;
	const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
	return ladCode ? (ladStats?.[ladCode] ?? null) : null;
}

function fuelPovertyDisplay(
	stats: AggregatedFuelPovertyData | null,
	measure: "rate" | "count",
) {
	if (!stats)
		return {
			value: undefined,
			formatted: "",
			unit: "",
			secondary: undefined,
			barWidth: 0,
		};
	if (measure === "count")
		return {
			value: stats.fuelPoorHouseholdCount,
			formatted: Math.round(stats.fuelPoorHouseholdCount).toLocaleString(
				"en-GB",
			),
			unit: "households",
			secondary: `${stats.fuelPovertyRate.toFixed(1)}%`,
			barWidth: Math.min(stats.fuelPoorHouseholdCount / 1000, 1) * 100,
		};
	return {
		value: stats.fuelPovertyRate,
		formatted: stats.fuelPovertyRate.toFixed(1),
		unit: "% households",
		secondary: `${formatCount(stats.fuelPoorHouseholdCount)} affected`,
		barWidth: Math.min(stats.fuelPovertyRate / 20, 1) * 100,
	};
}

export default function FuelPovertyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: Props) {
	const measure = useCurrentMapOptions().fuelPoverty.measure;
	const dataset = availableDatasets[year];
	const isDark = useIsDark();
	const [lsoaToLad, setLsoaToLad] = useState<Record<string, string> | null>(
		null,
	);

	useEffect(() => {
		if (!dataset) return;
		let cancelled = false;
		setLsoaToLad(null);
		fetchLsoaToLad(dataset.boundaryYear)
			.then((mapping) => {
				if (!cancelled) setLsoaToLad(mapping);
			})
			.catch((error: unknown) => {
				console.warn(
					"[fuel poverty] LSOA/LAD mapping unavailable:",
					error,
				);
			});
		return () => {
			cancelled = true;
		};
	}, [dataset]);

	const ladStats = useMemo(
		() =>
			dataset && lsoaToLad
				? aggregateFuelPovertyByLad(dataset.data, lsoaToLad)
				: null,
		[dataset, lsoaToLad],
	);
	const stats = dataset
		? resolveFuelPovertyStats(
				dataset,
				aggregatedData,
				selectedArea,
				ladStats,
				codeMapper,
			)
		: null;
	const isLocalAuthoritySummary =
		selectedArea?.type === "ward" ||
		selectedArea?.type === "localAuthority";
	const active =
		activeDataset?.type === "fuelPoverty" &&
		activeDataset.id === dataset?.id;
	const display = fuelPovertyDisplay(stats, measure);
	const accent = useHeatmapValueColor("fuelPoverty", display.value);
	if (!dataset) return null;
	return (
		<ChartCard
			coverage={formatDatasetCoverage(dataset) ?? "England"}
			heading="Fuel Poverty [2024]"
			headerEnd={
				isLocalAuthoritySummary && (
					<span
						className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
					>
						Local authority
					</span>
				)
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
				value={display.formatted}
				unit={display.unit}
				secondary={display.secondary}
				barWidth={display.barWidth}
				barColor={accent ?? undefined}
			/>
		</ChartCard>
	);
}
