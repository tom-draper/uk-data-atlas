import { datasetSlug, getChartDatasetTypeForSlug } from "@/lib/datasets";
import { declaredMapViews } from "@/lib/datasets/declared";
import type { ActiveViz, VizView } from "@/lib/types";

/**
 * Stable, public identity for a map visualisation. These values are suitable
 * for URLs and sharing; the camel-case fields in ActiveViz remain an internal
 * adapter for the existing dataset and chart registries.
 */
export type VisualizationRef = {
	dataset: string;
	period: number;
	view?: VizView;
};

/** The views a link may name for a dataset: those its map declares, and life expectancy's. */
function viewsOf(dataset: string): readonly string[] {
	if (dataset === "life-expectancy") return ["healthy-life-expectancy"];
	return declaredMapViews(dataset)?.map(({ id }) => id) ?? [];
}

function parseView(dataset: string, value: string | null): VizView | undefined {
	return viewsOf(dataset).find((view) => view === value) as
		VizView | undefined;
}

function internalDatasetId(
	datasetType: ActiveViz["datasetType"],
	period: number,
	view?: VizView,
): string {
	if (datasetType === "general-election") return `general-election-${period}`;
	if (datasetType === "life-expectancy")
		return view === "healthy-life-expectancy" ? "hle" : "le";
	return `${datasetType}${period}`;
}

export function parseVisualizationRef(
	params: URLSearchParams,
): VisualizationRef | null {
	const dataset = params.get("dataset");
	const periodValue = params.get("period");
	const period = Number(periodValue);
	if (
		!dataset ||
		!periodValue ||
		!Number.isSafeInteger(period) ||
		String(period) !== periodValue
	)
		return null;
	if (!getChartDatasetTypeForSlug(dataset)) return null;

	const viewValue = params.get("view");
	const view = parseView(dataset, viewValue);
	if (viewValue && !view) return null;
	return { dataset, period, ...(view ? { view } : {}) };
}

export function activeVizFromReference(
	reference: VisualizationRef,
): ActiveViz | null {
	const datasetType = getChartDatasetTypeForSlug(reference.dataset);
	if (!datasetType) return null;
	return {
		datasetId: internalDatasetId(
			datasetType,
			reference.period,
			reference.view,
		),
		datasetType,
		datasetYear: reference.period,
		...(reference.view ? { view: reference.view } : {}),
	};
}

export function visualizationRefFromActiveViz(
	viz: ActiveViz,
): VisualizationRef | null {
	if (viz.datasetType === "custom" || viz.datasetType === "network")
		return null;
	return {
		dataset: datasetSlug(viz.datasetType),
		period: viz.datasetYear,
		...(viz.view ? { view: viz.view } : {}),
	};
}
