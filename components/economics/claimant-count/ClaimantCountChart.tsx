"use client";

import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import type {
	AggregatedClaimantCountData,
	ClaimantCountDataset,
	ClaimantCountLADData,
} from "@/lib/types/claimantCount";

function statsForArea(
	dataset: ClaimantCountDataset,
	aggregated: Record<number, AggregatedClaimantCountData> | null,
	selectedArea: ChartComponentProps["selectedArea"],
	codeMapper: LadResolver | undefined,
): ClaimantCountLADData | AggregatedClaimantCountData | null {
	if (!selectedArea) return aggregated?.[dataset.year] ?? null;
	const code = selectedAreaLadCode(selectedArea, codeMapper);
	return code ? (dataset.data[code] ?? null) : null;
}

export default function ClaimantCountChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const measure = useCurrentMapOptions().claimantCount.measure;
	const dataset = (availableDatasets as Record<string, ClaimantCountDataset>)[
		year
	];
	if (!dataset) return null;

	const stats = statsForArea(
		dataset,
		aggregatedData as Record<number, AggregatedClaimantCountData> | null,
		selectedArea,
		codeMapper,
	);
	const value = stats?.[measure === "count" ? "totalCount" : "totalRate"];
	const color = useHeatmapValueColor("claimantCount", value);
	const isActive =
		activeDataset?.type === "claimantCount" &&
		activeDataset.id === dataset.id;
	const hasData = value !== undefined;

	return (
		<ChartCard
			heading={`Claimant Count, ${measure === "count" ? "total" : "rate"} [${dataset.month}]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, hasData)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={hasData ? color : null}
			isActive={isActive}
			title="ONS/Nomis. Claimant Count (UC + JSA). nomisweb.co.uk"
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
				unit={measure === "count" ? "claimants" : "% of 16–64"}
				secondary={
					stats ? `${stats.youthRate.toFixed(1)}% youth` : undefined
				}
				barWidth={
					value === undefined
						? 0
						: Math.min(
								100,
								(value / (measure === "count" ? 14000 : 10)) *
									100,
							)
				}
				barColor={color ?? undefined}
			/>
		</ChartCard>
	);
}
