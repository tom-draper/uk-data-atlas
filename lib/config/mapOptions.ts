import { MapOptions } from "../types";

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
	theme: {
		id: "viridis",
	},
	visibility: {
		hideDataLayer: false,
		hideBoundaries: false,
		hideOverlay: false,
	},
};
