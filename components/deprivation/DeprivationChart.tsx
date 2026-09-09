"use client";
import type { ActiveViz, Dataset } from "@lib/types";
import DecileChart from "./DecileChart";

/** The identity and wording of one national deprivation index. */
export interface DeprivationIndex {
	/** Dataset type as it appears on the active dataset, e.g. "imd". */
	datasetType: Dataset["type"];
	/** Short name shown in the heading, e.g. "IMD". */
	label: string;
	region: string;
	attribution: string;
	metric: DeprivationDetail["kind"];
	/** Highest value in this fixed index release, used to normalise its bar. */
	metricMaximum: number;
}

/** The one line of detail under the decile: a rank, or a deprivation score. */
export type DeprivationDetail =
	{ kind: "rank"; value: number } | { kind: "score"; value: number };

export function DeprivationChart({
	index,
	dataset,
	activeDataset,
	decile,
	detail,
	setActiveViz,
}: {
	index: DeprivationIndex;
	dataset: { id: string; type: Dataset["type"]; year: number };
	activeDataset: Dataset | null;
	decile: number | null;
	detail: DeprivationDetail | null;
	setActiveViz: (value: ActiveViz) => void;
}) {
	const hasDetail = detail !== null && Number.isFinite(detail.value);
	const barWidth = hasDetail
		? Math.max(
				0,
				Math.min(
					100,
					index.metric === "score"
						? (detail.value / index.metricMaximum) * 100
						: ((index.metricMaximum + 1 - detail.value) /
								index.metricMaximum) *
								100,
				),
			)
		: 0;

	return (
		<DecileChart
			title={index.attribution}
			heading={`Deprivation (${index.label}) [${dataset.year}]`}
			region={index.region}
			decile={decile === null ? null : Math.round(decile)}
			hasData={decile !== null}
			detail={
				hasDetail
					? {
							value:
								detail.kind === "rank"
									? Math.round(detail.value).toLocaleString()
									: detail.value.toFixed(1),
							unit: detail.kind,
						}
					: null
			}
			barWidth={barWidth}
			isActive={
				activeDataset?.type === index.datasetType &&
				activeDataset.id === dataset.id
			}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		/>
	);
}
