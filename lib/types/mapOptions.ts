// types/mapOptions.ts

export type MapMode = 'winner' | 'party-percentage';

export interface ColorRange {
    min: number;
    max: number;
}

export interface GeneralElectionOptions {
    mode: 'winner' | 'party-percentage';
    selectedParty?: string;
    partyPercentageRange?: ColorRange;
}

export interface LocalElectionOptions {
    mode: 'winner' | 'party-percentage';
    selectedParty?: string;
    partyPercentageRange?: ColorRange;
}

export interface PopulationOptions {
    colorRange?: ColorRange;
}

export interface DensityOptions {
    colorRange?: ColorRange;
}

export interface GenderOptions {
    colorRange?: ColorRange;
}

export interface MapOptions {
    'general-election': GeneralElectionOptions;
    'local-election': LocalElectionOptions;
    'age-distribution': PopulationOptions;
    'population-density': DensityOptions;
    'gender': GenderOptions;
}

// Default values
export const DEFAULT_MAP_OPTIONS: MapOptions = {
    'general-election': {
        mode: 'winner',
        partyPercentageRange: { min: 0, max: 100 }
    },
    'local-election': {
        mode: 'winner',
        partyPercentageRange: { min: 0, max: 100 }
    },
    'age-distribution': {
        colorRange: { min: 25, max: 55 }
    },
    'population-density': {
        colorRange: { min: 0, max: 8000 }
    },
    'gender': {
        colorRange: { min: -0.1, max: 0.1 }
    }
};