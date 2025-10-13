// lib/types/index.ts
export interface WardData {
    [key: string]: string | number;
}

export interface LocationBounds {
    name: string;
    lad_codes: string[];
    bounds: [number, number, number, number];
}

export interface ChartData {
    LAB: number;
    CON: number;
    LD: number;
    GREEN: number;
    REF: number;
    IND: number;
}

export interface Party {
    key: keyof ChartData;
    name: string;
    color: string;
}

export interface AgeData {
    [age: string]: number; // age -> count mapping (e.g., "0": 157, "1": 150, etc.)
}

export interface PopulationWardData {
    [wardCode: string]: {
        total: AgeData;
        males: AgeData;
        females: AgeData;
    };
}

export interface Dataset {
    id: string;
    name: string;
    year: number;
    type: 'election' | 'population';
    wardResults?: any;
    wardData?: any;
    populationData?: PopulationWardData;
    partyInfo: Party[];
}
