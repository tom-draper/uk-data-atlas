import { CHART_DATASET_DEFINITIONS } from "../datasets";
import { MapOptions, ChartMapOptions } from "../types/mapOptions";

const chartMapOptions: ChartMapOptions = Object.fromEntries(
	CHART_DATASET_DEFINITIONS.map((definition) => [
		definition.type,
		{ colorRange: definition.map?.colorRange ?? { min: 0, max: 1 } },
	]),
) as ChartMapOptions;

export const DEFAULT_MAP_OPTIONS: MapOptions = {
	...chartMapOptions,
	generalElection: {
		mode: "majority",
		percentageRange: { min: 0, max: 100 },
		colorRange: { min: 0, max: 1 },
	},
	localElection: {
		mode: "majority",
		percentageRange: { min: 0, max: 100 },
		colorRange: { min: 0, max: 1 },
	},
	ageDistribution: {
		colorRange: { min: 25, max: 65 },
	},
	populationDensity: {
		colorRange: { min: 0, max: 8000 },
	},
	gender: {
		colorRange: { min: -0.1, max: 0.1 },
	},
	ethnicity: {
		mode: "majority",
		percentageRange: { min: 0, max: 100 },
		colorRange: { min: 0, max: 1 },
	},
	brexit: { colorRange: { min: 30, max: 70 } },
	brexitConstituency: { colorRange: { min: 30, max: 70 } },
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
