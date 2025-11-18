// lib/types/index.ts

export interface LocalElectionWardData {
    localAuthorityCode: string
    localAuthorityName: string
    totalVotes: number;
    turnoutPercent: number;
    wardName: string;
    wardCode: string;
    electorate: number;
    partyVotes: PartyVotes
}

export interface LocationBounds {
    lad_codes: string[];
    bounds: [number, number, number, number];
}

export interface PartyVotes {
    LAB?: number;
    CON?: number;
    LD?: number;
    GREEN?: number;
    REF?: number;
    BRX?: number;
    UKIP?: number;
    SNP?: number;
    DUP?: number;
    PC?: number;
    SF?: number;
    APNI?: number;
    SDLP?: number;
    IND?: number;
    RUK?: number;
    UUP?: number;
    OTHER?: number;
}

export interface Party {
    key: keyof PartyVotes;
    name: string;
}

export interface AgeData {
    [age: string]: number; // age -> count mapping (e.g., "0": 157, "1": 150, etc.)
}

export interface PopulationWardData {
    total: AgeData;
    males: AgeData;
    females: AgeData;
    wardName: string;
    laCode: string;
    laName: string;
}

export type Dataset = GeneralElectionDataset | PopulationDataset | LocalElectionDataset | HousePriceDataset;

export interface PopulationDataset {
    id: string;
    name: string;
    type: 'population';
    year: number;
    wardYear: number;
    boundaryType: 'ward'
    populationData: { [wardCode: string]: PopulationWardData };
}

export interface LocalElectionDataset {
    id: string;
    name: string;
    type: 'local-election';
    year: number;
    wardYear: number;
    boundaryType: 'ward'
    wardResults: Record<string, string>;
    wardData: { [wardCode: string]: LocalElectionWardData };
    partyInfo: Party[];
}

export interface ConstituencyData {
    constituencyName: string;
    onsId: string;
    regionName: string;
    countryName: string;
    constituencyType: string;
    memberFirstName: string;
    memberSurname: string;
    memberGender: string;
    result: string;
    firstParty: string;
    secondParty: string;
    electorate: number;
    validVotes: number;
    invalidVotes: number;
    majority: number;
    partyVotes: PartyVotes;
    turnoutPercent: number;
}

export interface GeneralElectionDataset {
    id: string;
    name: string;
    type: 'general-election';
    year: number;
    constituencyYear: number;
    boundaryType: 'constituency';
    constituencyResults: Record<string, string>; // onsId -> winning party
    constituencyData: { [constituencyCode: string]: ConstituencyData }; // onsId -> full data
    partyInfo: Party[];
}

export interface WardHousePriceData {
    localAuthorityCode: string;
    localAuthorityName: string;
    wardCode: string;
    wardName: string;
    prices: {[year: number]: number};
}

export interface HousePriceDataset {
    id: string;
    name: string;
    type: 'house-price';
    year: number;
    wardYear: number;
    boundaryType: 'ward',
    wardData: Record<string, WardHousePriceData>; // Keyed by ward code
}

export interface AggregatedLocalElectionData {
    2024: WardStats;
    2023: WardStats;
    2022: WardStats;
    2021: WardStats;
}

export interface WardStats {
    partyVotes: PartyVotes,
    electorate: number
    totalVotes: number
}

export interface AggregateGeneralElectionData {
    2024: ConstituencyStats,
    2019: ConstituencyStats,
    2017: ConstituencyStats,
    2015: ConstituencyStats
}

export interface ConstituencyStats {
    totalSeats: number;
    partySeats: Record<string, number>;
    totalVotes: number;
    partyVotes: PartyVotes;
    electorate: number;
    validVotes: number;
    invalidVotes: number;
}

export interface AggregatedPopulationData {
    2020: {
        populationStats: PopulationStats;
        ageData: { [age: string]: number };
        ages: Array<{ age: number; count: number }>;
        genderAgeData: Array<{ age: number; males: number; females: number }>;
        medianAge: number;
        totalArea: number;
        density: number;
    }
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
