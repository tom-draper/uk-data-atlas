// lib/types/mapOptions.ts
import { Datasets } from "./datasets";
import { ColorRange } from "./common";
import type { BaseMapStyle } from "../config/baseMapStyles";

// Base option types reused across visualizations
interface ColorRangeOption {
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

export type GeneralElectionOptions = CategoryOptions;
export type LocalElectionOptions = CategoryOptions;
export type HousePriceOptions = ColorRangeOption;
export type EthnicityOptions = CategoryOptions;
export type CrimeOptions = ColorRangeOption;
export type PopulationOptions = ColorRangeOption;
export type DensityOptions = ColorRangeOption;
export type GenderOptions = ColorRangeOption;
export type IncomeOptions = ColorRangeOption;
export type BrexitOptions = ColorRangeOption;
export type BrexitConstituencyOptions = ColorRangeOption;
export type IMDOptions = ColorRangeOption;
export type SIMDOptions = ColorRangeOption;
export type WIMDOptions = ColorRangeOption;
export type NIMDMOptions = ColorRangeOption;
export type LifeExpectancyOptions = ColorRangeOption;
export type QualificationOptions = ColorRangeOption;
export type BroadbandOptions = ColorRangeOption;
export type AirQualityOptions = ColorRangeOption;
export type SchoolPerformanceOptions = ColorRangeOption;
export type ClaimantCountOptions = ColorRangeOption;
export type NHSWaitingOptions = ColorRangeOption;
export type UnemploymentOptions = ColorRangeOption;
export type ChildPovertyOptions = ColorRangeOption;

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

export interface MapOptions {
	generalElection: GeneralElectionOptions;
	localElection: LocalElectionOptions;
	ageDistribution: PopulationOptions;
	populationDensity: DensityOptions;
	gender: GenderOptions;
	ethnicity: EthnicityOptions;
	housePrice: HousePriceOptions;
	crime: CrimeOptions;
	income: IncomeOptions;
	brexit: BrexitOptions;
	brexitConstituency: BrexitConstituencyOptions;
	custom: CustomOptions;
	imd: IMDOptions;
	simd: SIMDOptions;
	wimd: WIMDOptions;
	nimdm: NIMDMOptions;
	lifeExpectancy: LifeExpectancyOptions;
	qualification: QualificationOptions;
	broadband: BroadbandOptions;
	airQuality: AirQualityOptions;
	schoolPerformance: SchoolPerformanceOptions;
	claimantCount: ClaimantCountOptions;
	nhsWaiting: NHSWaitingOptions;
	unemployment: UnemploymentOptions;
	childPoverty: ChildPovertyOptions;
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
}
