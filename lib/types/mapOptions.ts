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

export type GeneralElectionOptions = ElectionOption;
export type LocalElectionOptions = ElectionOption;
export type HousePriceOptions = ColorRangeOption;
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
    housePrice: HousePriceOptions;
    crime: CrimeOptions;
    income: IncomeOptions;
    general: {
        theme: ColorTheme;
    };
    visibility: {
        hideDataLayer: boolean;
        hideBoundaries: boolean;
    }
}

export const DEFAULT_MAP_OPTIONS: MapOptions = {
    generalElection: {
        mode: 'winner',
        partyPercentageRange: { min: 0, max: 100 }
    },
    localElection: {
        mode: 'winner',
        partyPercentageRange: { min: 0, max: 100 }
    },
    ageDistribution: {
        colorRange: { min: 25, max: 55 }
    },
    populationDensity: {
        colorRange: { min: 0, max: 8000 }
    },
    gender: {
        colorRange: { min: -0.1, max: 0.1 }
    },
    housePrice: {
        colorRange: { min: 80000, max: 500000 }
    },
    crime: {
        colorRange: { min: 0, max: 1000 }
    },
    income: {
        colorRange: { min: 20000, max: 40000 }
    },
    general: {
        theme: 'viridis'
    },
    visibility: {
        hideDataLayer: false,
        hideBoundaries: false
    }
};