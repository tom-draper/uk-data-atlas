"use client";

import { useMemo } from "react";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MeasureSeriesCard } from "@/components/measures/MeasureSeriesCard";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { areaForMeasure } from "@/lib/measures/area";
import { areaCodesInScope } from "@/lib/measures/scope";
import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";
import type { Dataset, DatasetCoverage, ActiveViz } from "@/lib/types";

type SeriesDataset = DatasetCoverage & {
	id: string;
	type: ActiveViz["datasetType"] & Dataset["type"];
};

/**
 * The history card of any dataset whose declaration sets `display.series`.
 * It names no dataset: the measure, release and wording are the declaration's.
 */
export default function MeasureSeriesChart({
	seriesForOptions,
	boundaryData,
	activeDataset,
	availableDatasets,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const options = useCurrentMapOptions();
	const series = seriesForOptions?.(options);
	const geography = series?.request.geography;
	const boundaryYear = series?.request.boundaryYear;
	const scope = useMemo(
		() =>
			geography && boundaryYear !== undefined
				? areaCodesInScope(boundaryData, geography, boundaryYear)
				: null,
		[boundaryData, geography, boundaryYear],
	);
	const dataset = (
		availableDatasets as Record<string, SeriesDataset> | undefined
	)?.[year];
	if (!series || !dataset) return null;

	const area =
		areaForMeasure(
			selectedArea,
			series.request.geography,
			series.request.boundaryYear,
			codeMapper as (CodeYearResolver & LadResolver) | undefined,
		) ?? null;

	return (
		<MeasureSeriesCard
			request={series.request}
			scope={scope}
			area={area}
			countMeasure={series.countMeasure}
			heading={`${series.heading} [${series.period}]`}
			accent={series.accent}
			color={series.line}
			title={series.source}
			coverage={series.coverage ?? formatDatasetCoverage(dataset)}
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
