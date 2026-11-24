import type {
	BoundaryGeojson,
	Features,
	PopulationAgeSexRecord,
} from "@lib/types";
import type { BoundaryCodeScope } from "../mapManager/propertyDetector";
import type { MapOptions } from "@lib/types/mapOptions";
import type { DisplayMapView } from "@uk-data-atlas/datasets";
import {
	getGenderColorExpression,
	getSequentialColorExpression,
} from "@/lib/helpers/colorScale/datasetColors";
import { calculateMedianAge, calculateTotal } from "@uk-data-atlas/datasets";
import { valueGeojson, type MapRenderContext } from "./context";

/** Any population vintage, whatever geography its records are keyed by. */
type PopulationRenderDataset = { data: Record<string, PopulationAgeSexRecord> };

/** The figure a view colours an area by, from the area's record. */
function computedValue(
	computed: DisplayMapView["value"]["computed"],
	record: PopulationAgeSexRecord,
): number {
	switch (computed) {
		case "total":
			return (
				calculateTotal(record.males) + calculateTotal(record.females)
			);
		case "medianAge":
			return calculateMedianAge(record) ?? 0;
		case "genderBalance": {
			const males = calculateTotal(record.males);
			const females = calculateTotal(record.females);
			return females > 0 ? (males - females) / females : 0;
		}
	}
}

/** A population view's value for one area, or null where it has no record. */
export function populationViewValue(
	ctx: MapRenderContext,
	view: DisplayMapView,
	record: PopulationAgeSexRecord | undefined,
	feature: Features[number],
): number | null {
	if (!record) return null;
	const value = computedValue(view.value.computed, record);
	if (!view.value.perSquareKm) return value;
	const area = ctx.featureBuilder.getFeatureAreaSqKm(feature);
	return area > 0 ? value / area : 0;
}

/** The colour range a view reads from the map options. */
export const populationViewOptions = (
	view: DisplayMapView,
	mapOptions: MapOptions,
) =>
	(
		mapOptions as unknown as Record<
			string,
			{ colorRange: { min: number; max: number } }
		>
	)[view.optionsKey];

/** Colours a population dataset by one of its declared map views. */
export function renderPopulationView(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationRenderDataset,
	mapOptions: MapOptions,
	view: DisplayMapView,
	scope: BoundaryCodeScope = "ward",
): void {
	const codeProp = ctx.codeProp(scope, geojson.features);
	const { colorRange } = populationViewOptions(view, mapOptions);

	const transformedGeojson = valueGeojson(
		ctx,
		geojson,
		dataset,
		`population-${view.id}`,
		codeProp,
		(code, feature) =>
			populationViewValue(ctx, view, dataset.data[code], feature),
	);
	ctx.layerManager.render({
		kind: "boundary-fill",
		data: transformedGeojson,
		colorExpression:
			view.palette === "gender"
				? getGenderColorExpression(colorRange)
				: getSequentialColorExpression(colorRange, mapOptions.theme.id),
		visibility: mapOptions.visibility,
	});
	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}
