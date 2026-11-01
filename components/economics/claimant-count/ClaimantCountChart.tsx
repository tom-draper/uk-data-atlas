"use client";

import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { localAuthorityStats } from "@/lib/helpers/localAuthorityStats";
import { useHeatmapValueColor } from "@/lib/hooks/useHeatmapValueColor";
import type {
	AggregatedClaimantCountData,
	ClaimantCountDataset,
	ClaimantCountLADData,
} from "@uk-data-atlas/datasets/types/claimantCount";

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

	const stats = localAuthorityStats(
		dataset,
		aggregatedData as Record<number, AggregatedClaimantCountData> | null,
		selectedArea,
		codeMapper,
		(record) => record,
	);
	const value = stats?.[measure === "count" ? "totalCount" : "totalRate"];
	const color = useHeatmapValueColor("claimantCount", value);
	const isActive =
		activeDataset?.type === "claimantCount" &&
		activeDataset.id === dataset.id;
	const hasData = value !== undefined;

	return (
		<ChartCard
			coverage={formatDatasetCoverage(dataset) ?? "Great Britain"}
			heading={`Claimant Count [${dataset.year}]`}
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
