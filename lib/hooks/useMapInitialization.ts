import { MAP_TYPE } from "../config/map";
import { useMapLibreInitialization } from "./useMapLibreInitialization";
import type { useMapboxInitialization as UseMapboxInitialization } from "./useMapboxInitialization";

interface UseMapInitializationOptions {
	style: string;
	center: [number, number];
	zoom: number;
	maxBounds: [number, number, number, number];
}

export function useMapInitialization(options: UseMapInitializationOptions) {
	if (MAP_TYPE === "mapbox") {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { useMapboxInitialization } = require(/* webpackIgnore: true */ "./useMapboxInitialization") as {
			useMapboxInitialization: typeof UseMapboxInitialization;
		};
		return useMapboxInitialization(options);
	}

	return useMapLibreInitialization(options);
}
