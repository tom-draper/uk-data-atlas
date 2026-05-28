import { MapOptions } from "../types/mapOptions";

export const DEFAULT_MAP_OPTIONS: MapOptions = {
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
	},
	housePrice: {
		colorRange: { min: 80000, max: 500000 },
	},
	crime: {
		colorRange: { min: 10000, max: 100000 },
	},
	income: {
		colorRange: { min: 25000, max: 45000 },
	},
	brexit: { colorRange: { min: 30, max: 70 } },
	brexitConstituency: { colorRange: { min: 30, max: 70 } },
	custom: { colorRange: { min: 0, max: 100 } },
	imd: { colorRange: { min: 1, max: 70 } },
	simd: { colorRange: { min: 1, max: 6976 } },
	wimd: { colorRange: { min: 1, max: 1909 } },
	nimdm: { colorRange: { min: 1, max: 890 } },
	lifeExpectancy: { colorRange: { min: 72, max: 84 } },
	qualification: { colorRange: { min: 0, max: 60 } },
	theme: {
		id: "viridis",
	},
	baseStyle: {
		id: "positron",
	},
	visibility: {
		hideDataLayer: false,
		hideBoundaries: false,
		hideOverlay: false,
		overlayOpacity: 0.6,
	},
};
