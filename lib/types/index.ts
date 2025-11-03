// lib/types/index.ts
export interface WardData {
    [key: string]: string | number | undefined;
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
    SNP: number;
    DUP: number;
    PC: number;
    SF: number;
    APNI: number;
    SDLP: number;
    IND: number;
}

export interface Party {
    key: keyof ChartData;
    name: string;
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

export interface AggregatedLocalElectionData {
    data2024: ChartData | null;
    data2023: ChartData | null;
    data2022: ChartData | null;
    data2021: ChartData | null;
}

export interface AggregateGeneralElectionData {
	totalSeats: number;
	partySeats: Record<string, number>;
	totalVotes: number;
	partyVotes: Record<string, number>;
	partyInfo: Record<string, { name: string; color: string }>;
}

// Common geometry type
type PolygonGeometry = {
    type: "Polygon";
    coordinates: number[][][]; // Array of linear rings (each ring is an array of [lon, lat] pairs)
};

// Shared base for all features
interface BaseFeature {
    type: "Feature";
    id: number;
    geometry: PolygonGeometry;
}

// Define year-specific property sets
interface Properties2024 {
    FID: number;
    GlobalID: string;
    LAD24CD: string;
    LAD24NM: string;
    LAD24NMW: string;
    WD24CD: string;
    WD24NM: string;
    WD24NMW: string;
    BNG_E: number;
    BNG_N: number;
    LAT: number;
    LONG: number;
}

interface Properties2023 {
    FID: number;
    GlobalID: string;
    WD23CD: string;
    WD23NM: string;
    WD23NMW: string;
    BNG_E: number;
    BNG_N: number;
    LAT: number;
    LONG: number;
}

interface Properties2022 {
    OBJECTID: number;
    GlobalID: string;
    LAD22CD: string;
    LAD22NM: string;
    WD22CD: string;
    WD22NM: string;
    WD22NMW: string;
    BNG_E: number;
    BNG_N: number;
    LAT: number;
    LONG: number;
}

interface Properties2021 {
    OBJECTID: number;
    GlobalID: string;
    WD21CD: string;
    WD21NM: string;
    WD21NMW: string;
    BNG_E: number;
    BNG_N: number;
    LAT: number;
    LONG: number;
}

// Map each year to its property type
type YearToProperties = {
    2021: Properties2021;
    2022: Properties2022;
    2023: Properties2023;
    2024: Properties2024;
};

// Feature type — parameterized by year
type Feature<Y extends keyof YearToProperties> = BaseFeature & {
    properties: YearToProperties[Y];
};

// Create a union of all feature types
type AnyFeature = {
    [Y in keyof YearToProperties]: Feature<Y>;
}[keyof YearToProperties];

// Generic WardGeojson with default type
export interface BoundaryGeojson<Y extends keyof YearToProperties = keyof YearToProperties> {
    crs: {
        type: string;
        properties: {
            name: string;
        };
    };
    features: Y extends keyof YearToProperties ? Feature<Y>[] : AnyFeature[];
    type: "FeatureCollection";
}

export interface AgeGroups {
    '0-17': number;
    '18-29': number;
    '30-44': number;
    '45-64': number;
    '65+': number;
}

export interface PopulationStats {
    total: number;
    males: number;
    females: number;
    ageGroups: {
        total: AgeGroups;
        males: AgeGroups;
        females: AgeGroups;
    };
    isWardSpecific: boolean;
}

export interface PopulationChartProps {
    population: PopulationWardData;
    onDatasetChange: (datasetId: string) => void;
    wardCode: string;
    wardName: string;
    wardCodeMap: { [name: string]: string };
}