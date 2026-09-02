import { SCALAR_DATASET_DEFINITIONS } from "../datasets";
import { MapOptions, ScalarMapOptions } from "../types/mapOptions";

const scalarMapOptions: ScalarMapOptions = Object.fromEntries(
	SCALAR_DATASET_DEFINITIONS.map((definition) => [
		definition.type,
		{ colorRange: definition.map.colorRange },
	]),
) as ScalarMapOptions;

export const DEFAULT_MAP_OPTIONS: MapOptions = {
	...scalarMapOptions,
	generalElection: {
		mode: "majority",
		percentageRange: { min: 0, max: 100 },
	},
	localElection: {
		mode: "majority",
		percentageRange: { min: 0, max: 100 },
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
	housePrice: {
		colorRange: { min: 80000, max: 500000 },
	},
	crime: { colorRange: { min: 10000, max: 100000 } },
	income: { colorRange: { min: 25000, max: 45000 } },
	brexit: { colorRange: { min: 30, max: 70 } },
	brexitConstituency: { colorRange: { min: 30, max: 70 } },
	custom: { colorRange: { min: 0, max: 100 } },
	imd: { colorRange: { min: 1, max: 70 } },
	simd: { colorRange: { min: 1, max: 6976 } },
	wimd: { colorRange: { min: 1, max: 1909 } },
	nimdm: { colorRange: { min: 1, max: 890 } },
	lifeExpectancy: { colorRange: { min: 72, max: 84 } },
	qualification: { colorRange: { min: 25, max: 60 } },
	broadband: { colorRange: { min: 50, max: 100 } },
	airQuality: { colorRange: { min: 5, max: 35 } },
	schoolPerformance: { colorRange: { min: 50, max: 80 } },
	claimantCount: { colorRange: { min: 1, max: 8 } },
	nhsWaiting: { colorRange: { min: 25, max: 40 } },
	unemployment: { colorRange: { min: 2, max: 8 } },
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
