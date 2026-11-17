"use client";

import type { ChartComponentProps } from "@/components/chartComponentTypes";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MeasureBreakdownCard } from "@/components/measures/MeasureBreakdownCard";
import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { areaForMeasure } from "@/lib/measures/area";
import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";
import type { Dataset, DatasetCoverage, ActiveViz } from "@/lib/types";

type BreakdownDataset = DatasetCoverage & {
	id: string;
	type: ActiveViz["datasetType"] & Dataset["type"];
};

/**
 * The breakdown card of any dataset whose declaration sets
 * `display.breakdown`. It names no dataset: the measure, dimension, colours
 * and wording are the declaration's.
 */
export default function MeasureBreakdownChart({
	breakdown,
	activeDataset,
	availableDatasets,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const dataset = (
		availableDatasets as Record<string, BreakdownDataset> | undefined
	)?.[year];
	if (!breakdown || !dataset) return null;

	const { geography, boundaryYear } = breakdown.request;
	const area =
		areaForMeasure(
			selectedArea,
			geography,
			boundaryYear,
			codeMapper as (CodeYearResolver & LadResolver) | undefined,
		) ?? null;

	return (
		<MeasureBreakdownCard
			request={breakdown.request}
			area={area}
			dimension={breakdown.dimension}
			total={breakdown.total}
			parts={breakdown.parts}
			accent={breakdown.accent}
			heading={`${breakdown.heading} [${breakdown.period}]`}
			title={breakdown.source}
			coverage={breakdown.coverage ?? formatDatasetCoverage(dataset)}
			estimateNote={(hasData) =>
				isLocalAuthorityEstimate(selectedArea, hasData)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			isActive={
				activeDataset?.type === dataset.type &&
				activeDataset.id === dataset.id
			}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: year,
				})
			}
		/>
	);
}
