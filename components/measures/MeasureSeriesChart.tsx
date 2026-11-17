"use client";

import type { ChartComponentProps } from "@/components/chartComponentTypes";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MeasureSeriesCard } from "@/components/measures/MeasureSeriesCard";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { areaForMeasure } from "@/lib/measures/area";
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
	activeDataset,
	availableDatasets,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const options = useCurrentMapOptions();
	const series = seriesForOptions?.(options);
	const dataset = (
		availableDatasets as Record<string, SeriesDataset> | undefined
	)?.[year];
	if (!series || !dataset) return null;

	const { geography, boundaryYear } = series.request;
	const area =
		areaForMeasure(
			selectedArea,
			geography,
			boundaryYear,
			codeMapper as (CodeYearResolver & LadResolver) | undefined,
		) ?? null;

	return (
		<MeasureSeriesCard
			request={series.request}
			area={area}
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
