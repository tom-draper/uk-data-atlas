// lib/types/mapOptions.ts
import { type Datasets } from "./datasets.ts";
import { type ColorRange } from "@uk-data-atlas/datasets";
import type { BaseMapStyle } from "../config/baseMapStyles.ts";
import type { CatalogueDatasetType } from "../data/catalog/index.ts";
import type { DeclaredDatasetId } from "@uk-data-atlas/datasets";

// Base option types reused across visualizations
export interface ColorRangeOption {
	colorRange: ColorRange;
}

export interface HousePriceOptions extends ColorRangeOption {
	measure: "median" | "mean";
}

export interface IncomeOptions extends ColorRangeOption {
	period: "annual" | "hourly";
	measure: "median" | "mean";
}

export interface SchoolPerformanceOptions extends ColorRangeOption {
	measure: "grade4" | "grade5" | "attainment8" | "progress8";
}

export interface LifeExpectancyOptions extends ColorRangeOption {
	measure: "average" | "male" | "female";
}

export interface FuelPovertyOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface CustomOptions extends ColorRangeOption {
	selectedPointValue?: number;
	excludedPointValues?: number[];
}

export interface CategoryOptions {
	mode: "majority" | "percentage";
	metric?: "votes" | "turnout";
	selected?: string;
	excluded?: string[];
	percentageRange: ColorRange;
	turnoutRange?: ColorRange;
}

/** Click-to-isolate / right-click-to-exclude state for a map-native network layer's legend. */
export interface NetworkOptions {
	selected?: string;
	excluded?: string[];
}

/** Options of a dataset whose display is declared: the choice is one of its measure ids. */
export interface DeclaredMapOptions extends ColorRangeOption {
	measure: string;
}

/** Declared datasets whose map has options of its own, listed below. */
type CustomMapDatasetId =
	"brexit" | "brexit-constituency" | "general-election" | "local-election";

/** Declared datasets whose map options are the declared display's. */
type DisplayedDatasetId = Exclude<DeclaredDatasetId, CustomMapDatasetId>;

export type ChartMapOptions = Omit<
	Record<CatalogueDatasetType, ColorRangeOption>,
	| DisplayedDatasetId
	| "fuelPoverty"
	| "housePrice"
	| "income"
	| "lifeExpectancy"
	| "schoolPerformance"
> &
	Record<DisplayedDatasetId, DeclaredMapOptions> & {
		fuelPoverty: FuelPovertyOptions;
		housePrice: HousePriceOptions;
		income: IncomeOptions;
		schoolPerformance: SchoolPerformanceOptions;
		lifeExpectancy: LifeExpectancyOptions;
	};

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
	"general-election": CategoryOptions;
	"local-election": CategoryOptions;
	ethnicity: CategoryOptions;
	ageDistribution: ColorRangeOption;
	populationDensity: ColorRangeOption;
	gender: ColorRangeOption;
	brexit: ColorRangeOption;
	"brexit-constituency": ColorRangeOption;
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
