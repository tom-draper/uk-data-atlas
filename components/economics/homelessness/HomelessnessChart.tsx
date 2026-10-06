"use client";

import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { formatCompactCount } from "@/lib/helpers/formatCount";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import type {
	AggregatedHomelessnessData,
	HomelessnessDataset,
	HomelessnessLADData,
} from "@/lib/types/homelessness";

function statsForArea(
	dataset: HomelessnessDataset,
	aggregated: Record<number, AggregatedHomelessnessData> | null,
	selectedArea: ChartComponentProps["selectedArea"],
	codeMapper: LadResolver | undefined,
): HomelessnessLADData | AggregatedHomelessnessData | null {
	if (!selectedArea) return aggregated?.[dataset.year] ?? null;
	const code = selectedAreaLadCode(selectedArea, codeMapper);
	return code ? (dataset.data[code] ?? null) : null;
}

export default function HomelessnessChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const measure = useCurrentMapOptions().homelessness.measure;
	const dataset = (availableDatasets as Record<string, HomelessnessDataset>)[
		year
	];
	if (!dataset) return null;

	const stats = statsForArea(
		dataset,
		aggregatedData as Record<number, AggregatedHomelessnessData> | null,
		selectedArea,
		codeMapper,
	);
	const value =
		stats?.[
			measure === "count"
				? "householdsInTemporaryAccommodation"
				: "householdsPerThousand"
		];
	const color = useHeatmapValueColor("homelessness", value);
	const isActive =
		activeDataset?.type === "homelessness" &&
		activeDataset.id === dataset.id;
	const hasData = value !== undefined;

	return (
		<ChartCard
			heading={`Homelessness, ${measure === "count" ? "households" : "rate"} [${dataset.quarter}]`}
			headingTitle="Homelessness: temporary accommodation"
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, hasData)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="Ministry of Housing, Communities and Local Government. Statutory homelessness statistics. gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={hasData}
				value={
					value === undefined
						? "—"
						: measure === "count"
							? value.toLocaleString("en-GB")
							: value.toFixed(1)
				}
				unit={
					measure === "count"
						? "households in TA"
						: "per 1k households"
				}
				secondary={
					stats
						? `${formatCompactCount(stats.childrenInTemporaryAccommodation)} children in TA`
						: undefined
				}
				barWidth={
					value === undefined
						? 0
						: Math.min(
								100,
								(value / (measure === "count" ? 2500 : 15)) *
									100,
							)
				}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
