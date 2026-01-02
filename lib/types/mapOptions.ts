// lib/types/mapOptions.ts
import { Datasets } from ".";
import { ColorRange } from "./common";

// Base option types reused across visualizations
interface ColorRangeOption {
	colorRange: ColorRange;
}

export interface CategoryOptions {
	mode: "majority" | "percentage";
	selected?: string;
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

export type ColorTheme = "viridis" | "plasma" | "inferno" | "magma";

export type MapMode = keyof Datasets | 'custom';

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
	theme: {
		id: ColorTheme;
	};
	visibility: {
		hideDataLayer: boolean;
		hideBoundaries: boolean;
		hideOverlay: boolean;
	};
}
