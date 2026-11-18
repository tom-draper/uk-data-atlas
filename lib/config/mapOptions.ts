import { CHART_DATASET_DEFINITIONS } from "../datasets";
import {
	declaredDefaultOptions,
	declaredMapViewOptions,
} from "../datasets/declared";
import { declaredCategoryOptions } from "../datasets/categories";
import { MapOptions, ChartMapOptions } from "../types/mapOptions";

const chartMapOptions: ChartMapOptions = Object.fromEntries(
	CHART_DATASET_DEFINITIONS.map((definition) => [
		definition.type,
		{
			colorRange: definition.map?.colorRange ?? { min: 0, max: 1 },
			...declaredDefaultOptions(definition.type),
		},
	]),
) as ChartMapOptions;

export const DEFAULT_MAP_OPTIONS: MapOptions = {
	...chartMapOptions,
	"general-election": {
		mode: "majority",
		metric: "votes",
		percentageRange: { min: 0, max: 50 },
		turnoutRange: { min: 0, max: 100 },
		colorRange: { min: 0, max: 1 },
	},
	"local-election": {
		mode: "majority",
		metric: "votes",
		percentageRange: { min: 0, max: 50 },
		turnoutRange: { min: 0, max: 100 },
		colorRange: { min: 0, max: 1 },
	},
	...(declaredMapViewOptions() as Pick<
		MapOptions,
		"ageDistribution" | "populationDensity" | "gender"
	>),
	...declaredCategoryOptions(),
	brexit: { colorRange: { min: 30, max: 70 } },
	"brexit-constituency": { colorRange: { min: 30, max: 70 } },
	custom: { colorRange: { min: 0, max: 100 } },
	network: {},
	theme: {
		id: "viridis",
	},
	baseStyle: {
		id: "positron",
	},
	visibility: {
		hideDataLayer: false,
		hideBorders: false,
		hideBoundaryLayer: false,
		hideOverlay: false,
		overlayOpacity: 0.6,
	},
};
