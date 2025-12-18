// lib/types/mapOptions.ts
// Map visualization options and defaults

import { ColorRange } from "./common";

// Base option types reused across visualizations
interface ColorRangeOption {
    colorRange?: ColorRange;
}

interface ElectionOption {
    mode: 'winner' | 'party-percentage';
    selectedParty?: string;
    partyPercentageRange?: ColorRange;
}

interface CategoryOptions {
    mode: 'majority' | 'percentage';
    selected?: string;
    percentageRange?: ColorRange;
}

export type GeneralElectionOptions = ElectionOption;
export type LocalElectionOptions = ElectionOption;
export type HousePriceOptions = ColorRangeOption;
export type EthnicityOptions = CategoryOptions;
export type CrimeOptions = ColorRangeOption;
export type PopulationOptions = ColorRangeOption;
export type DensityOptions = ColorRangeOption;
export type GenderOptions = ColorRangeOption;
export type IncomeOptions = ColorRangeOption;

export type ColorTheme = 'viridis' | 'plasma' | 'inferno' | 'magma';

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
    }
}
