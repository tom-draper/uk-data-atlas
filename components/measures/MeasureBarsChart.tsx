"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MeasureBarsCard } from "@/components/measures/MeasureBarsCard";
import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { areaForMeasure } from "@/lib/measures/area";
import { areaCodesInScope } from "@/lib/measures/scope";
import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";
import type { ActiveViz, Dataset, DatasetCoverage } from "@/lib/types";

type BarsDataset = DatasetCoverage & {
	id: string;
	type: ActiveViz["datasetType"] & Dataset["type"];
	year: number;
	dataPeriod?: string;
	metadata?: { source?: string };
};

/**
 * The bars card of any chart definition that sets `bars`. One chart can
 * switch between datasets (`le`, `hle`): it follows the active one and
 * remembers the last when another topic is active.
 */
export default function MeasureBarsChart({
	bars,
	datasetId,
	boundaryData,
	activeDataset,
	availableDatasets,
	selectedArea,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const [remembered, setRemembered] = useState(datasetId);
	const datasets = availableDatasets as
		Record<string, BarsDataset> | undefined;
	const type = datasets?.[datasetId ?? ""]?.type;
	const following = !!activeDataset && activeDataset.type === type;
	const selectedId = following ? activeDataset.id : remembered;
	const followedId = following ? activeDataset.id : undefined;
	useEffect(() => {
		if (followedId) setRemembered(followedId);
	}, [followedId]);

	const geography = bars?.request.geography;
	const boundaryYear = bars?.request.boundaryYear;
	const scope = useMemo(
		() =>
			geography && boundaryYear !== undefined
				? areaCodesInScope(boundaryData, geography, boundaryYear)
				: null,
		[boundaryData, geography, boundaryYear],
	);
	const dataset = selectedId ? datasets?.[selectedId] : undefined;
	const measure = selectedId ? bars?.measures[selectedId] : undefined;
	if (!bars || !dataset || !measure) return null;

	const area =
		areaForMeasure(
			selectedArea,
			bars.request.geography,
			bars.request.boundaryYear,
			codeMapper as (CodeYearResolver & LadResolver) | undefined,
		) ?? null;

	return (
		<MeasureBarsCard
			request={{ ...bars.request, measure }}
			scope={scope}
			area={area}
			dimension={bars.dimension}
			bars={bars.bars}
			combine={bars.combine}
			ramp={bars.ramp}
			digits={bars.digits}
			heading={
				dataset.dataPeriod
					? `${bars.heading} [${dataset.dataPeriod}]`
					: bars.heading
			}
			title={dataset.metadata?.source}
			coverage={formatDatasetCoverage(dataset)}
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
					datasetYear: dataset.year,
					...(bars.views?.[dataset.id]
						? { view: bars.views[dataset.id] as ActiveViz["view"] }
						: {}),
				})
			}
		/>
	);
}
