"use client";

import { createContext, use } from "react";
import type { MapOptions } from "@/lib/types/mapOptions";

const MapOptionsContext = createContext<MapOptions | null>(null);

export const MapOptionsProvider = MapOptionsContext.Provider;

export function useCurrentMapOptions(): MapOptions {
	const mapOptions = use(MapOptionsContext);
	if (!mapOptions) {
		throw new Error(
			"useCurrentMapOptions must be used within MapOptionsProvider",
		);
	}
	return mapOptions;
}
