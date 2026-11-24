"use client";

import { useMemo } from "react";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MeasureBreakdownCard } from "@/components/measures/MeasureBreakdownCard";
import {
	formatDatasetCoverage,
	nationOutsideCoverage,
} from "@/lib/helpers/datasetCoverage";
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
	const { categories } = useExcludedCategories();
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

	const isActive =
		activeDataset?.type === dataset.type && activeDataset.id === dataset.id;
	// The legend filter only applies while this dataset is on the map.
	const filtered = isActive && breakdown.legendFilter === true;
	const legend = categories[dataset.type];
	// An area in a nation the dataset leaves out has no figure to read, so the
	// card says the nation does not publish it rather than that it is missing.
	const nation = nationOutsideCoverage(
		dataset.coverageCountries,
		selectedArea?.code,
	);
	const coverage = breakdown.coverage ?? formatDatasetCoverage(dataset);
	// Such an area keeps its own code, so the card never falls back to the
	// other nations' total while it is selected.
	const area = nation
		? (selectedArea?.code ?? null)
		: (areaForMeasure(
				selectedArea,
				breakdown.request.geography,
				breakdown.request.boundaryYear,
				codeMapper as (CodeYearResolver & LadResolver) | undefined,
			) ?? null);

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
							!legend?.excluded.has(label) &&
							(!legend?.selected || label === legend.selected)
					: undefined,
			}}
			heading={`${breakdown.heading} [${nation ?? breakdown.period}]`}
			title={breakdown.source}
			coverage={
				nation
					? `Here: ${nation}, not published. Elsewhere: ${coverage ?? "England & Wales"}, ${breakdown.period}.`
					: coverage
			}
			emptyMessage={
				nation ? `Not published in this form for ${nation}` : undefined
			}
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
