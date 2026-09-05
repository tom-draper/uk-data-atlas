import type {
	BoundaryGeojson,
	Features,
	PopulationAgeSexRecord,
} from "@lib/types";
import type { BoundaryCodeScope } from "@/lib/helpers/datasetAggregation/ports";
import type { MapOptions } from "@lib/types/mapOptions";
import {
	getGenderColorExpression,
	getSequentialColorExpression,
} from "@/lib/helpers/colorScale/datasetColors";
import { calculateMedianAge, calculateTotal } from "@/lib/helpers/population";
import type { MapExpression } from "../mapManager/expressions";
import { valueGeojson, type MapRenderContext } from "./context";

/** Any population vintage, whatever geography its records are keyed by. */
type PopulationRenderDataset = { data: Record<string, PopulationAgeSexRecord> };

function renderPopulation(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationRenderDataset,
	mapOptions: MapOptions,
	mode: "population-age" | "population-gender" | "population-density",
	valueFor: (code: string, feature: Features[number]) => number | null,
	colorExpression: (options: MapOptions) => MapExpression,
	scope: BoundaryCodeScope,
): void {
	const codeProp = ctx.codeProp(scope, geojson.features);

	const transformedGeojson = valueGeojson(
		ctx,
		geojson,
		dataset,
		mode,
		codeProp,
		valueFor,
	);
	ctx.layerManager.render({
		kind: "boundary-fill",
		data: transformedGeojson,
		colorExpression: colorExpression(mapOptions),
		visibility: mapOptions.visibility,
	});
	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}

export function renderAgeDistribution(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationRenderDataset,
	mapOptions: MapOptions,
	scope: BoundaryCodeScope = "ward",
): void {
	renderPopulation(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"population-age",
		(code) => {
			const record = dataset.data[code];
			return record ? (calculateMedianAge(record) ?? 0) : null;
		},
		(options) =>
			getSequentialColorExpression(
				options.ageDistribution.colorRange,
				options.theme.id,
			),
		scope,
	);
}

export function renderGender(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationRenderDataset,
	mapOptions: MapOptions,
	scope: BoundaryCodeScope = "ward",
): void {
	renderPopulation(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"population-gender",
		(code) => {
			const record = dataset.data[code];
			if (!record) return null;
			const males = calculateTotal(record.males);
			const females = calculateTotal(record.females);
			return females > 0 ? (males - females) / females : 0;
		},
		(options) => getGenderColorExpression(options.gender.colorRange),
		scope,
	);
}

export function renderPopulationDensity(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationRenderDataset,
	mapOptions: MapOptions,
	scope: BoundaryCodeScope = "ward",
): void {
	renderPopulation(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"population-density",
		(code, feature) => {
			const record = dataset.data[code];
			if (!record) return null;
			const total =
				calculateTotal(record.males) + calculateTotal(record.females);
			const area = ctx.featureBuilder.getFeatureAreaSqKm(feature);
			return area > 0 ? total / area : 0;
		},
		(options) =>
			getSequentialColorExpression(
				options.populationDensity.colorRange,
				options.theme.id,
			),
		scope,
	);
}
