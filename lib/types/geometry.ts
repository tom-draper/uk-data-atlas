// lib/types/geometry.ts
// GeoJSON and boundary-related types

import { ValueOf } from "next/dist/shared/lib/constants";

// Year-specific properties for boundaries
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

export type Properties = ValueOf<YearToProperties>

export type YearToProperties = {
    2021: Properties2021;
    2022: Properties2022;
    2023: Properties2023;
    2024: Properties2024;
};

type PolygonGeometry = {
    type: "Polygon";
    coordinates: number[][][];
};

interface BaseFeature {
    type: "Feature";
    id: number;
    geometry: PolygonGeometry;
}

export type Feature<Y extends keyof YearToProperties = keyof YearToProperties> = BaseFeature & {
    properties: YearToProperties[Y];
};

export type AnyFeature = Feature<keyof YearToProperties>;

export interface BoundaryGeojson<Y extends keyof YearToProperties = keyof YearToProperties> {
    crs: {
        type: string;
        properties: {
            name: string;
        };
    };
    features: Feature<Y>[];
    type: "FeatureCollection";
}

export interface LocationBounds {
    lad_codes: string[];
    bounds: [number, number, number, number];
}