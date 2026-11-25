"use client";

import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import {
	DeprivationChart,
	type DeprivationView,
} from "@/components/datasets/society/deprivation/DeprivationChart";
import { resolveDeprivation } from "@/components/datasets/society/deprivation/deprivationStats";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { declaredMeasure } from "@/lib/datasets/declared";
import type { DeprivationCardConfig } from "@/lib/datasets/deprivationCard";
import { earlierEditionRows } from "@/lib/datasets/deprivationEditions";
import type { ActiveViz } from "@/lib/types";
import type {
	DeprivationSummary,
	ScoredDeprivationSummary,
} from "@uk-data-atlas/datasets";

type Record = { [field: string]: unknown };

/** An authority's summary, which an index with domains gives a score for each. */
type Summary = (DeprivationSummary | ScoredDeprivationSummary) & {
	domainScores?: { [domain: string]: number | null | undefined };
};

type DeprivationDataset = {
	id: string;
	type: ActiveViz["datasetType"];
	year: number;
	data: { [code: string]: Record };
	[summaryField: string]: unknown;
};

const numberAt = (record: Record, field: string | undefined) => {
	const value = field === undefined ? undefined : record[field];
	return typeof value === "number" ? value : null;
};

/**
 * The card of any chart definition that sets `deprivation`: one small area
 * shows its own rank or score and decile, a larger area its summary. An index
 * with domains shows a domain's score instead when one is the chosen measure.
 */
export default function MeasureDeprivationChart({
	deprivation,
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	codeMapper,
	setActiveViz,
}: ChartComponentProps) {
	const options = useCurrentMapOptions();
	const dataset = (
		availableDatasets as unknown as
			{ [year: string]: DeprivationDataset } | undefined
	)?.[year];
	if (!deprivation || !dataset) return null;

	const resolved = resolveDeprivation<Record, Summary>({
		aggregated: (aggregatedData?.[dataset.year] as Summary) ?? null,
		ladStats:
			(dataset[deprivation.summaryField] as {
				[code: string]: Summary;
			}) ?? {},
		selectedArea,
		fineArea: { type: deprivation.areaType, records: dataset.data },
		codeMapper,
	});

	const measure = declaredMeasure(deprivation.datasetType, options);
	if (deprivation.domains && measure) {
		if (measure.id !== deprivation.headlineMeasure)
			return (
				<DomainScoreCard
					deprivation={deprivation}
					domains={deprivation.domains}
					measure={measure}
					dataset={dataset}
					resolved={resolved}
					activeDataset={activeDataset}
					setActiveViz={setActiveViz}
				/>
			);
	}

	let view: DeprivationView | null = null;
	if (resolved?.kind === "summary") view = resolved;
	else if (resolved) {
		const detail = numberAt(resolved.record, deprivation.metricField);
		view = {
			kind: "area",
			decile: numberAt(resolved.record, deprivation.decileField),
			detail:
				detail === null
					? null
					: { kind: deprivation.metric, value: detail },
		};
	}

	const earlierEditions = earlierEditionRows({
		config: deprivation,
		latest: dataset,
		datasets:
			(availableDatasets as unknown as {
				[year: string]: DeprivationDataset | undefined;
			}) ?? {},
		selectedArea,
		codeMapper,
	});

	return (
		<DeprivationChart
			index={deprivation}
			dataset={dataset}
			activeDataset={activeDataset}
			view={view}
			earlierEditions={earlierEditions}
			setActiveViz={setActiveViz}
		/>
	);
}

function DomainScoreCard({
	deprivation,
	domains,
	measure,
	dataset,
	resolved,
	activeDataset,
	setActiveViz,
}: {
	deprivation: DeprivationCardConfig;
	domains: NonNullable<DeprivationCardConfig["domains"]>;
	measure: { id: string; label: string };
	dataset: DeprivationDataset;
	resolved: ReturnType<typeof resolveDeprivation<Record, Summary>>;
	activeDataset: ChartComponentProps["activeDataset"];
	setActiveViz: ChartComponentProps["setActiveViz"];
}) {
	const value =
		resolved?.kind === "area"
			? numberAt(resolved.record, measure.id)
			: (resolved?.summary.domainScores?.[measure.id] ?? null);
	return (
		<ChartCard
			coverage={deprivation.region}
			heading={`${measure.label} [${dataset.year}]`}
			accent="#f59e0b"
			isActive={activeDataset?.id === dataset.id}
			title={domains.attribution}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartCardValueBar
				hasData={value !== null}
				value={value === null ? "" : value.toFixed(3)}
				unit="domain score"
				secondary={
					resolved?.kind === "summary"
						? "Population-weighted average"
						: "LSOA score"
				}
				barWidth={0}
			/>
		</ChartCard>
	);
}
