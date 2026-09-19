"use client";

import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { ActiveViz } from "@/lib/types";

type Display = {
	label: string;
	unit: string;
	prefix?: string;
	digits?: number;
	maximum: number;
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
		label: "Average Band D council tax",
		unit: "",
		prefix: "£",
		maximum: 4_000,
		digits: 0,
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
	if (!dataset) return null;
	const display = DISPLAY[dataset.type] ?? {
		label: dataset.type,
		unit: "",
		maximum: 1,
	};
	const direct = selectedRecord(dataset, selectedArea);
	const aggregate = aggregatedData?.[year] as { value?: number } | undefined;
	const value =
		direct?.value ?? (!selectedArea ? aggregate?.value : undefined);
	const hasData = value !== undefined;
	const digits = display.digits ?? 0;
	const formatted = hasData
		? `${display.prefix ?? ""}${value!.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`
		: "—";
	return (
		<ChartCard
			heading={`${display.label} [${dataset.year}]`}
			accent={hasData ? "#0ea5e9" : null}
			isActive={
				activeDataset?.type === dataset.type &&
				activeDataset.id === dataset.id
			}
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
				barWidth={
					hasData
						? Math.min(100, (value! / display.maximum) * 100)
						: 0
				}
				barColor="#0ea5e9"
			/>
		</ChartCard>
	);
}
