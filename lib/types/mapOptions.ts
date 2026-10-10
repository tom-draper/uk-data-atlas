// lib/types/mapOptions.ts
import { Datasets } from "./datasets";
import { ColorRange } from "./common";
import type { BaseMapStyle } from "../config/baseMapStyles";
import type { CatalogueDatasetType } from "@/lib/data/catalog";

// Base option types reused across visualizations
export interface ColorRangeOption {
	colorRange: ColorRange;
}

export interface HousePriceOptions extends ColorRangeOption {
	measure: "median" | "mean";
}

export interface IncomeOptions extends ColorRangeOption {
	measure: "median" | "mean";
}

export interface CountMetricOptions extends ColorRangeOption {
	measure: "total" | "perPopulation";
}

export interface BroadbandOptions extends ColorRangeOption {
	measure: "fullFibre" | "superfast" | "ultrafast" | "gigabit";
}

export interface AirQualityOptions extends ColorRangeOption {
	measure: "no2" | "pm25" | "pm10";
}

export interface GhgEmissionsOptions extends ColorRangeOption {
	measure: "perPerson" | "total" | "excludingLandUse";
}

export interface UnemploymentOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface ClaimantCountOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface HomelessnessOptions extends ColorRangeOption {
	measure: "rate" | "count";
}

export interface SchoolPerformanceOptions extends ColorRangeOption {
	measure: "grade4" | "grade5" | "attainment8" | "progress8";
}

export interface LifeExpectancyOptions extends ColorRangeOption {
	measure: "average" | "male" | "female";
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

export type ChartMapOptions = Omit<
	Record<CatalogueDatasetType, ColorRangeOption>,
	| "housePrice"
	| "income"
	| "lifeExpectancy"
	| "businessActivity"
	| "electricVehicleChargers"
	| "jobs"
	| "broadband"
	| "airQuality"
	| "ghgEmissions"
	| "unemployment"
	| "claimantCount"
	| "homelessness"
	| "schoolPerformance"
> & {
	housePrice: HousePriceOptions;
	income: IncomeOptions;
	businessActivity: CountMetricOptions;
	electricVehicleChargers: CountMetricOptions;
	jobs: CountMetricOptions;
	broadband: BroadbandOptions;
	airQuality: AirQualityOptions;
	ghgEmissions: GhgEmissionsOptions;
	unemployment: UnemploymentOptions;
	claimantCount: ClaimantCountOptions;
	homelessness: HomelessnessOptions;
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
