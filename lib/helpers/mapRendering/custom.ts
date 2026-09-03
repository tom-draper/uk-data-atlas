import type { BoundaryGeojson, CustomDataset } from "@lib/types";
import type { ColorRange } from "@/lib/types/common";
import type { MapOptions } from "@lib/types/mapOptions";
import { getSequentialColorExpression } from "@/lib/helpers/colorScale/datasetColors";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";
import { nullFallback } from "../mapManager/expressions";
import { valueGeojson, type MapRenderContext } from "./context";

// An uploaded dataset's value range never changes, so it is derived once per
// dataset. Keyed weakly, the entry goes when the upload itself does.
const customRangeCache = new WeakMap<CustomDataset, ColorRange>();

function customRange(dataset: CustomDataset): ColorRange | null {
	const cached = customRangeCache.get(dataset);
	if (cached) return cached;

	let min = Infinity;
	let max = -Infinity;
	for (const value of Object.values(dataset.data)) {
		if (value < min) min = value;
		if (value > max) max = value;
	}
	if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

	const range = { min, max };
	customRangeCache.set(dataset, range);
	return range;
}

export function renderCustomDataset(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: CustomDataset,
	mapOptions: MapOptions,
): void {
	const codeProp = ctx.codeProp("any", geojson.features);

	const transformedGeojson = valueGeojson(
		ctx,
		geojson,
		dataset,
		"custom-choropleth",
		codeProp,
		(code) => dataset.data[code] ?? null,
	);
	const range = customRange(dataset);
	ctx.layerManager.render({
		kind: "boundary-fill",
		data: transformedGeojson,
		colorExpression: range
			? getSequentialColorExpression(range, mapOptions.theme.id)
			: nullFallback("value", "#cccccc", "#cccccc"),
		visibility: mapOptions.visibility,
	});

	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}

// Renders a custom point dataset (coordinates / postcodes) as coloured
// markers, independent of any boundary geometry.
export function renderCustomPoints(
	ctx: MapRenderContext,
	dataset: CustomDataset,
	mapOptions: MapOptions,
	bounds: [number, number, number, number] | null = null,
	isDark = false,
): void {
	const excludedValues = new Set(mapOptions.custom.excludedPointValues ?? []);
	const selectedValue = mapOptions.custom.selectedPointValue;
	const locationPoints = getPointsInBounds(dataset.points ?? [], bounds);
	const points = locationPoints.filter(
		(point) =>
			!excludedValues.has(point.value) &&
			(selectedValue === undefined || point.value === selectedValue),
	);
	if (points.length === 0) {
		ctx.layerManager.clearPointLayers();
		return;
	}

	let min = dataset.valueMin;
	let max = dataset.valueMax;
	if (min === undefined || max === undefined) {
		min = Infinity;
		max = -Infinity;
		for (const p of points) {
			if (p.value < min) min = p.value;
			if (p.value > max) max = p.value;
		}
	}

	const collection = ctx.featureBuilder.buildPointCollection(
		points,
		min,
		max,
		mapOptions.theme.id,
		dataset.pointStyle?.colorByValue,
	);
	// Add the point layers first, then blank the choropleth beneath. Doing it
	// in this order matters: clearBoundaryData() calls setData() on the boundary
	// source, which flips map.isStyleLoaded() to false until the worker re-parses.
	// the point renderer bails early when the style isn't loaded, so blanking
	// first would drop the points entirely when switching from a boundary dataset
	// (the map would just clear). Refreshing straight into a point dataset hid the
	// bug because no boundary source existed yet.
	ctx.layerManager.render({
		kind: "points",
		data: collection,
		visibility: mapOptions.visibility,
		radius: dataset.pointStyle?.radius,
		tooltip: dataset.pointStyle?.tooltip,
		isDark,
	});
	ctx.layerManager.clearBoundaryData();
}
