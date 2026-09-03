// lib/types/mapOptions.ts
import { Datasets } from "./datasets";
import { ColorRange } from "./common";
import type { BaseMapStyle } from "../config/baseMapStyles";
import type { CatalogueDatasetType } from "@/lib/data/catalog";

// Base option types reused across visualizations
export interface ColorRangeOption {
	colorRange: ColorRange;
}

export interface CustomOptions extends ColorRangeOption {
	selectedPointValue?: number;
	excludedPointValues?: number[];
}

export interface CategoryOptions {
	mode: "majority" | "percentage";
	selected?: string;
	excluded?: string[];
	percentageRange: ColorRange;
}

/** Click-to-isolate / right-click-to-exclude state for a map-native network layer's legend. */
export interface NetworkOptions {
	selected?: string;
	excluded?: string[];
}

export type ChartMapOptions = Record<CatalogueDatasetType, ColorRangeOption>;

export type ColorTheme =
	| "viridis"
	| "plasma"
	| "redblue"
	| "ryg"
	| "brownteal"
	| "purpleorange"
	| "pinkgreen"
	| "ylorrd"
	| "purplered"
	| "turbo"
	| "coolwarm"
	| "spectral"
	| "ylgnbu"
	| "ylgn";

export type MapMode = keyof Datasets | "custom";

/**
 * The dataset types whose map options carry a colour range, so the shared
 * choropleth path can read `mapOptions[dataset.type].colorRange` without a
 * cast. Derived, so a new option group joins or leaves it automatically.
 */
export type NumericMapOptionsKey = Extract<
	MapMode,
	{
		[K in keyof MapOptions]: MapOptions[K] extends ColorRangeOption
			? K
			: never;
	}[keyof MapOptions]
>;

export type MapOptions = ChartMapOptions & {
	generalElection: CategoryOptions;
	localElection: CategoryOptions;
	ethnicity: CategoryOptions;
	ageDistribution: ColorRangeOption;
	populationDensity: ColorRangeOption;
	gender: ColorRangeOption;
	brexit: ColorRangeOption;
	brexitConstituency: ColorRangeOption;
	custom: CustomOptions;
	network: NetworkOptions;
	theme: {
		id: ColorTheme;
	};
	baseStyle: {
		id: BaseMapStyle["id"];
	};
	visibility: {
		hideDataLayer: boolean;
		hideBorders: boolean;
		hideBoundaryLayer: boolean;
		hideOverlay: boolean;
		overlayOpacity: number;
	};
};

export type ColorRangeMapOptionKey = {
	[Key in keyof MapOptions]: MapOptions[Key] extends ColorRangeOption
		? Key
		: never;
}[keyof MapOptions];
