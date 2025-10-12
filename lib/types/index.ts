
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