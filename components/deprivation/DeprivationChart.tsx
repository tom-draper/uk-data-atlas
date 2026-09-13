"use client";
import type { ActiveViz, Dataset } from "@lib/types";
import type { DeprivationSummary } from "@/lib/types/deprivation";
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
	/** What the index calls its small areas, e.g. "LSOAs". */
	areaNoun: string;
}

/** The one line of detail under the decile: a rank, or a deprivation score. */
export type DeprivationDetail =
	{ kind: "rank"; value: number } | { kind: "score"; value: number };

/** One small area as published, or a group of them summarised. */
export type DeprivationView =
	| { kind: "area"; decile: number | null; detail: DeprivationDetail | null }
	| { kind: "summary"; summary: DeprivationSummary };

/**
 * By construction a tenth of a nation's areas sit in its most deprived tenth,
 * so a group at 10% is typical. The colour scale puts that at its midpoint and
 * saturates at twice the national rate.
 */
const TYPICAL_SHARE = 0.1;

function summaryDisplay(summary: DeprivationSummary, areaNoun: string) {
	const share = summary.mostDeprivedCount / summary.areaCount;
	const severity = Math.min(1, share / (TYPICAL_SHARE * 2));
	return {
		value: `${Math.round(share * 100)}%`,
		unit: "in most deprived 10%",
		secondary: `${summary.mostDeprivedCount.toLocaleString()} of ${summary.areaCount.toLocaleString()} ${areaNoun}`,
		barWidth: severity * 100,
		severity,
	};
}

function areaDisplay(
	index: DeprivationIndex,
	decile: number | null,
	detail: DeprivationDetail | null,
) {
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
	const displayDecile = decile === null ? null : 11 - Math.round(decile);
	return {
		hasData: decile !== null || hasDetail,
		value: hasDetail
			? detail.kind === "rank"
				? Math.round(detail.value).toLocaleString()
				: detail.value.toFixed(1)
			: (displayDecile ?? ""),
		unit: hasDetail ? detail.kind : "decile",
		secondary:
			hasDetail && displayDecile !== null
				? `Decile ${displayDecile}`
				: undefined,
		barWidth,
		severity: barWidth / 100,
		colorValue: !hasDetail,
	};
}

export function DeprivationChart({
	index,
	dataset,
	activeDataset,
	view,
	setActiveViz,
}: {
	index: DeprivationIndex;
	dataset: { id: string; type: Dataset["type"]; year: number };
	activeDataset: Dataset | null;
	view: DeprivationView | null;
	setActiveViz: (value: ActiveViz) => void;
}) {
	const display =
		view === null
			? null
			: view.kind === "summary"
				? {
						hasData: true,
						...summaryDisplay(view.summary, index.areaNoun),
					}
				: areaDisplay(index, view.decile, view.detail);

	return (
		<DecileChart
			title={index.attribution}
			heading={`Deprivation (${index.label}) [${dataset.year}]`}
			region={index.region}
			hasData={display?.hasData ?? false}
			value={display?.value ?? ""}
			unit={display?.unit ?? "decile"}
			secondary={display?.secondary}
			barWidth={display?.barWidth ?? 0}
			severity={display?.severity ?? 0}
			colorValue={
				display !== null &&
				"colorValue" in display &&
				display.colorValue
			}
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
