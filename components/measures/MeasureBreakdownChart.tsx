"use client";

import { useMemo } from "react";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MeasureBreakdownCard } from "@/components/measures/MeasureBreakdownCard";
import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { areaForMeasure } from "@/lib/measures/area";
import { areaCodesInScope } from "@/lib/measures/scope";
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
	boundaryData,
	activeDataset,
	availableDatasets,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const { excludedEthnicities, selectedEthnicity } = useExcludedCategories();
	const geography = breakdown?.request.geography;
	const boundaryYear = breakdown?.request.boundaryYear;
	const scope = useMemo(
		() =>
			geography && boundaryYear !== undefined
				? areaCodesInScope(boundaryData, geography, boundaryYear)
				: null,
		[boundaryData, geography, boundaryYear],
	);
	const dataset = (
		availableDatasets as Record<string, BreakdownDataset> | undefined
	)?.[year];
	if (!breakdown || !dataset) return null;

	const area =
		areaForMeasure(
			selectedArea,
			breakdown.request.geography,
			breakdown.request.boundaryYear,
			codeMapper as (CodeYearResolver & LadResolver) | undefined,
		) ?? null;

	const isActive =
		activeDataset?.type === dataset.type && activeDataset.id === dataset.id;
	// The legend filter only applies while this dataset is on the map.
	const filtered = isActive && breakdown.legendFilter === "ethnicity";

	return (
		<MeasureBreakdownCard
			request={breakdown.request}
			scope={scope}
			area={area}
			dimension={breakdown.dimension}
			total={breakdown.total}
			parts={breakdown.parts}
			accent={breakdown.accent}
			options={{
				order: breakdown.order,
				includes: filtered
					? (label) =>
							!excludedEthnicities.has(label) &&
							(!selectedEthnicity || label === selectedEthnicity)
					: undefined,
			}}
			heading={`${breakdown.heading} [${breakdown.period}]`}
			title={breakdown.source}
			coverage={breakdown.coverage ?? formatDatasetCoverage(dataset)}
			estimateNote={(hasData) =>
				isLocalAuthorityEstimate(selectedArea, hasData)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			isActive={isActive}
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
