// types/mapOptions.ts

export type MapMode = 'winner' | 'party-percentage';

export interface GeneralElectionMapOptions {
    mode: MapMode;
    selectedParty?: string; // Party code like 'Lab', 'Con', etc.
}

export interface LocalElectionMapOptions {
    mode: MapMode;
    selectedParty?: string;
}

export interface PopulationMapOptions {
    // Future options for population maps
    mode: 'absolute' | 'density';
}

export type MapOptions = {
    'general-election': GeneralElectionMapOptions;
    'local-election': LocalElectionMapOptions;
    'population': PopulationMapOptions;
};

export const DEFAULT_MAP_OPTIONS: MapOptions = {
    'general-election': {
        mode: 'winner',
        selectedParty: undefined,
    },
    'local-election': {
        mode: 'winner',
        selectedParty: undefined,
    },
    'population': {
        mode: 'absolute',
    },
};