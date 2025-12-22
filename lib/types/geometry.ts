// lib/types/geometry.ts
import { ValueOf } from "next/dist/shared/lib/constants";

// Ward properties by year
interface WardProperties2024 {
	LAD24CD: string;
	LAD24NM: string;
	WD24CD: string;
	WD24NM: string;
}

interface WardProperties2023 {
	WD23CD: string;
	WD23NM: string;
}

interface WardProperties2022 {
	LAD22CD: string;
	LAD22NM: string;
	WD22CD: string;
	WD22NM: string;
}

interface WardProperties2021 {
	WD21CD: string;
	WD21NM: string;
}

// Local Authority properties by year
interface LocalAuthorityProperties2025 {
	LAD25CD: string;
	LAD25NM: string;
}

interface LocalAuthorityProperties2024 {
	LAD24CD: string;
	LAD24NM: string;
}

interface LocalAuthorityProperties2023 {
	LAD23CD: string;
	LAD23NM: string;
}

interface LocalAuthorityProperties2022 {
	LAD22CD: string;
	LAD22NM: string;
}

interface LocalAuthorityProperties2021 {
	LAD21CD: string;
	LAD21NM: string;
}

// Constituency properties by year
interface ConstituencyProperties2024 {
	PCON24CD: string;
	PCON24NM: string;
}

interface ConstituencyProperties2019 {
	pcon19cd: string;
	pcon19nm: string;
}

interface ConstituencyProperties2017 {
	PCON17CD: string;
	PCON17NM: string;
}

interface ConstituencyProperties2015 {
	PCON15CD: string;
	PCON15NM: string;
}

// Unified mapping of all boundary types by year
export type YearToProperties = {
	// Wards
	ward_2021: WardProperties2021;
	ward_2022: WardProperties2022;
	ward_2023: WardProperties2023;
	ward_2024: WardProperties2024;
	// Local Authorities
	lad_2021: LocalAuthorityProperties2021;
	lad_2022: LocalAuthorityProperties2022;
	lad_2023: LocalAuthorityProperties2023;
	lad_2024: LocalAuthorityProperties2024;
	lad_2025: LocalAuthorityProperties2025;
	// Constituencies
	constituency_2015: ConstituencyProperties2015;
	constituency_2017: ConstituencyProperties2017;
	constituency_2019: ConstituencyProperties2019;
	constituency_2024: ConstituencyProperties2024;
};

export type Properties = ValueOf<YearToProperties>;

type KeysOfUnion<T> = T extends any ? keyof T : never;

export type PropertyKeys = KeysOfUnion<Properties>;

type PolygonGeometry = {
	type: "Polygon";
	coordinates: number[][][];
};

interface BaseFeature {
	type: "Feature";
	id: number;
	geometry: PolygonGeometry;
}

export type Feature = BoundaryGeojson["features"][0];
export type Features = BoundaryGeojson["features"];

export type BoundaryGeojsonFeature<
	Y extends keyof YearToProperties = keyof YearToProperties,
> = BaseFeature & {
	properties: YearToProperties[Y];
};

export type AnyFeature = BoundaryGeojson<keyof YearToProperties>;

export interface BoundaryGeojson<
	Y extends keyof YearToProperties = keyof YearToProperties,
> {
	crs: {
		type: string;
		properties: {
			name: string;
		};
	};
	features: BoundaryGeojsonFeature<Y>[];
	type: "FeatureCollection";
}

export interface LocationBounds {
	lad_codes: string[];
	bounds: [number, number, number, number];
}
