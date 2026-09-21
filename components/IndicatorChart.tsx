"use client";

import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ActiveViz } from "@/lib/types";
import type { NumericMapOptionsKey } from "@/lib/types/mapOptions";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";

type Display = {
	label: string;
	unit: string;
	prefix?: string;
	digits?: number;
	maximum: number;
	secondary?: string;
};

const DISPLAY: Record<string, Display> = {
	businessActivity: {
		label: "Businesses",
		unit: "enterprises",
		maximum: 100_000,
	},
	netAdditionalDwellings: {
		label: "Net additional dwellings",
		unit: "homes",
		maximum: 10_000,
	},
	localGovernmentFinance: {
		label: "Education services spending",
		unit: "£k",
		prefix: "£",
		maximum: 1_000_000,
	},
	councilTax: {
		label: "Council Tax",
		unit: "",
		prefix: "£",
		maximum: 4_000,
		digits: 0,
		secondary: "Avg Band D",
	},
	waste: { label: "Collected waste", unit: "tonnes", maximum: 500_000 },
	adultSocialCareActivity: {
		label: "Long-term support clients",
		unit: "clients",
		maximum: 50_000,
	},
	adultSocialCareOutcomes: {
		label: "Social care quality of life",
		unit: "/ 24",
		maximum: 24,
		digits: 1,
	},
	planningApplications: {
		label: "Planning applications",
		unit: "received",
		maximum: 3_000,
	},
	electricVehicleChargers: {
		label: "Public EV chargers",
		unit: "chargers",
		maximum: 5_000,
	},
};

const selectedRecord = (
	dataset: IndicatorDataset,
	selectedArea: ChartComponentProps["selectedArea"],
) => {
	if (!selectedArea) return null;
	if (selectedArea.type === dataset.boundaryType)
		return dataset.data[selectedArea.code] ?? null;
	if (selectedArea.type === "ward" && "ladCode" in (selectedArea.data ?? {}))
		return dataset.data[String(selectedArea.data?.ladCode)] ?? null;
	return null;
};

const hoveredIndicatorValue = (record: unknown): number | undefined => {
	if (typeof record !== "object" || record === null) return undefined;
	const value = Reflect.get(record, "value");
	return typeof value === "number" ? value : undefined;
};

/** Prefer the map hover record for the active card when no direct code matches. */
export const resolveIndicatorValue = (
	dataset: IndicatorDataset,
	selectedArea: ChartComponentProps["selectedArea"],
	isActive: boolean,
): number | undefined =>
	selectedRecord(dataset, selectedArea)?.value ??
	(isActive ? hoveredIndicatorValue(selectedArea?.data) : undefined);

/** Shared card for the newly added, count-like published indicators. */
export default function IndicatorChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: ChartComponentProps) {
	const dataset = (availableDatasets as Record<string, IndicatorDataset>)[
		year
	];
	const valueDatasetType = dataset?.type as NumericMapOptionsKey | undefined;
	const isActive =
		activeDataset?.type === dataset?.type &&
		activeDataset.id === dataset?.id;
	const value = dataset
		? resolveIndicatorValue(dataset, selectedArea, isActive)
		: undefined;
	const aggregate = aggregatedData?.[year] as { value?: number } | undefined;
	const resolvedValue =
		value ?? (!selectedArea ? aggregate?.value : undefined);
	const valueColor = useHeatmapValueColor(valueDatasetType, resolvedValue);
	if (!dataset) return null;
	const display = DISPLAY[dataset.type] ?? {
		label: dataset.type,
		unit: "",
		maximum: 1,
	};
	const hasData = resolvedValue !== undefined;
	const digits = display.digits ?? 0;
	const formatted = hasData
		? `${display.prefix ?? ""}${resolvedValue!.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`
		: "—";
	return (
		<ChartCard
			heading={`${display.label} [${dataset.year}]`}
			accent={valueColor}
			isActive={isActive}
			title="Source and methodology are available in the data catalogue."
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type as ActiveViz["datasetType"],
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={hasData}
				value={formatted}
				unit={display.unit}
				secondary={display.secondary}
				barWidth={
					hasData
						? Math.min(
								100,
								(resolvedValue! / display.maximum) * 100,
							)
						: 0
				}
				barColor={valueColor ?? undefined}
			/>
		</ChartCard>
	);
}
