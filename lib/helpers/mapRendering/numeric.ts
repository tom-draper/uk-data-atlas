import type { BoundaryGeojson } from "@lib/types";
import type { BoundaryType } from "@/lib/types/boundaries";
import type { ColorRange } from "@/lib/types/common";
import type {
	MapMode,
	MapOptions,
	NumericMapOptionsKey,
} from "@lib/types/mapOptions";
import { getSequentialColorExpression } from "@/lib/helpers/colorScale/datasetColors";
import type { BoundaryCodeScope } from "../mapManager/propertyDetector";
import { valueGeojson, type MapRenderContext } from "./context";

export type NumericDataset = {
	/** Names both the map mode and the options group holding its colour range. */
	type: NumericMapOptionsKey;
	boundaryType: BoundaryType;
	data: Record<string, unknown>;
};

export interface NumericMapConfig<T extends NumericDataset> {
	valueKey?: string;
	valueFor?(dataset: T, code: string): number | null;
	invertColor?: boolean;
	getColorRange?(dataset: T): ColorRange;
}

/** Paints one value per boundary on the theme's sequential colour ramp. */
function renderChoropleth<T extends { data: Record<string, unknown> }>(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: T,
	mapOptions: MapOptions,
	scope: BoundaryCodeScope,
	eventType: MapMode,
	dataForEvents: Record<string, unknown>,
	valueFor: (dataset: T, code: string) => number | null | undefined,
	getColorRange: (dataset: T, options: MapOptions) => ColorRange,
	invertColor = true,
): void {
	const codeProp = ctx.codeProp(scope, geojson.features);

	const transformedGeojson = valueGeojson(
		ctx,
		geojson,
		dataset,
		eventType,
		codeProp,
		(code) => valueFor(dataset, code),
	);
	ctx.layerManager.render({
		kind: "boundary-fill",
		data: transformedGeojson,
		colorExpression: getSequentialColorExpression(
			getColorRange(dataset, mapOptions),
			mapOptions.theme.id,
			invertColor,
		),
		visibility: mapOptions.visibility,
	});
	ctx.eventHandler.setupEventHandlers(dataForEvents, codeProp);
}

export function renderNumericDataset<T extends NumericDataset>(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: T,
	mapOptions: MapOptions,
	map: NumericMapConfig<T>,
): void {
	renderChoropleth(
		ctx,
		geojson,
		dataset,
		mapOptions,
		dataset.boundaryType,
		dataset.type,
		dataset.data,
		(data, code) => {
			const mappedValue = map.valueFor?.(data, code);
			if (mappedValue !== undefined) return mappedValue;
			const value = map.valueKey
				? (
						data.data[code] as unknown as
							Record<string, unknown> | undefined
					)?.[map.valueKey]
				: null;
			return typeof value === "number" && Number.isFinite(value)
				? value
				: null;
		},
		(data, options) =>
			map.getColorRange?.(data) ?? options[dataset.type].colorRange,
		map.invertColor,
	);
}
