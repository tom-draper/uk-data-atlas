import type { BoundaryGeojson, Features, PopulationDataset } from "@lib/types";
import type { MapOptions } from "@lib/types/mapOptions";
import {
	getGenderColorExpression,
	getSequentialColorExpression,
} from "@/lib/helpers/colorScale/datasetColors";
import { calculateMedianAge, calculateTotal } from "@/lib/helpers/population";
import type { MapExpression } from "../mapManager/expressions";
import { valueGeojson, type MapRenderContext } from "./context";

function renderPopulation(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationDataset,
	mapOptions: MapOptions,
	mode: "population-age" | "population-gender" | "population-density",
	valueFor: (code: string, feature: Features[number]) => number | null,
	colorExpression: (options: MapOptions) => MapExpression,
): void {
	const wardCodeProp = ctx.codeProp("ward", geojson.features);

	const transformedGeojson = valueGeojson(
		ctx,
		geojson,
		dataset,
		mode,
		wardCodeProp,
		valueFor,
	);
	ctx.layerManager.render({
		kind: "boundary-fill",
		data: transformedGeojson,
		colorExpression: colorExpression(mapOptions),
		visibility: mapOptions.visibility,
	});
	ctx.eventHandler.setupEventHandlers(dataset.data, wardCodeProp);
}

export function renderAgeDistribution(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationDataset,
	mapOptions: MapOptions,
): void {
	renderPopulation(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"population-age",
		(code) => {
			const ward = dataset.data[code];
			return ward ? calculateMedianAge(ward) ?? 0 : null;
		},
		(options) =>
			getSequentialColorExpression(
				options.ageDistribution.colorRange,
				options.theme.id,
			),
	);
}

export function renderGender(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationDataset,
	mapOptions: MapOptions,
): void {
	renderPopulation(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"population-gender",
		(code) => {
			const ward = dataset.data[code];
			if (!ward) return null;
			const males = calculateTotal(ward.males);
			const females = calculateTotal(ward.females);
			return females > 0 ? (males - females) / females : 0;
		},
		(options) => getGenderColorExpression(options.gender.colorRange),
	);
}

export function renderPopulationDensity(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: PopulationDataset,
	mapOptions: MapOptions,
): void {
	renderPopulation(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"population-density",
		(code, feature) => {
			const ward = dataset.data[code];
			if (!ward) return null;
			const total = calculateTotal(ward.males) + calculateTotal(ward.females);
			const area = ctx.featureBuilder.getFeatureAreaSqKm(feature);
			return area > 0 ? total / area : 0;
		},
		(options) =>
			getSequentialColorExpression(
				options.populationDensity.colorRange,
				options.theme.id,
			),
	);
}
