import { datasetSlug, getChartDatasetTypeForSlug } from "@/lib/datasets";
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

const VIEWS_BY_DATASET: Readonly<Record<string, readonly VizView[]>> = {
	population: ["age", "density", "gender"],
	"life-expectancy": ["healthy-life-expectancy"],
};

function parseView(dataset: string, value: string | null): VizView | undefined {
	return VIEWS_BY_DATASET[dataset]?.find((view) => view === value);
}

function internalDatasetId(
	datasetType: ActiveViz["datasetType"],
	period: number,
	view?: VizView,
): string {
	if (datasetType === "generalElection") return `generalElection-${period}`;
	if (datasetType === "lifeExpectancy")
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

export function writeVisualizationRef(params: URLSearchParams, viz: ActiveViz) {
	params.delete("dataset");
	params.delete("period");
	params.delete("view");
	const reference = visualizationRefFromActiveViz(viz);
	if (!reference) return;
	params.set("dataset", reference.dataset);
	params.set("period", String(reference.period));
	if (reference.view) params.set("view", reference.view);
}
