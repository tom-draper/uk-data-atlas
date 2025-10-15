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
    wardName: string;
    laCode: string;
    laName: string;
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

export interface AllYearsWardData {
	data2024: { [wardCode: string]: any };
	data2023: { [wardCode: string]: any };
	data2022: { [wardCode: string]: any };
	data2021: { [wardCode: string]: any };
}

export interface AllYearsAggregatedData {
	data2024: ChartData | null;
	data2023: ChartData | null;
	data2022: ChartData | null;
	data2021: ChartData | null;
}

export interface WardGeojson { 
    features: Array<{ 
        properties: { 
            WD24CD?: string; 
            WD23CD?: string; 
            WD22CD?: string; 
            WD21CD?: string; 
            WD23NM?: string; 
        }; 
    }>;
 }

