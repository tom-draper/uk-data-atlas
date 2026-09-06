// lib/types/geometry.ts
import { ValueOf } from "next/dist/shared/lib/constants";

// Ward properties by year
interface WardProperties2026 {
	LAD26CD: string;
	LAD26NM: string;
	WD26CD: string;
	WD26NM: string;
}

interface WardProperties2025 {
	LAD25CD: string;
	LAD25NM: string;
	WD25CD: string;
	WD25NM: string;
}

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

interface WardProperties2020 {
	WD20CD: string;
	WD20NM: string;
}

interface WardProperties2021 {
	WD21CD: string;
	WD21NM: string;
}

interface WardProperties2019 {
	lad19cd: string;
	lad19nm: string;
	wd19cd: string;
	wd19nm: string;
}

interface WardProperties2018 {
	lad18cd: string;
	lad18nm: string;
	wd18cd: string;
	wd18nm: string;
}

interface WardProperties2017 {
	lad17cd: string;
	lad17nm: string;
	wd17cd: string;
	wd17nm: string;
}

interface WardProperties2016 {
	lad16cd: string;
	lad16nm: string;
	wd16cd: string;
	wd16nm: string;
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

interface LocalAuthorityProperties2018 {
	lad18cd: string;
	lad18nm: string;
}

interface LocalAuthorityProperties2016 {
	LAD16CD: string;
	LAD16NM: string;
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
	pcon15cd: string;
	pcon15nm: string;
}

interface ConstituencyProperties2016 {
	pcon16cd: string;
	pcon16nm: string;
}

// LSOA properties by year
interface LSOAProperties2011 {
	LSOA11CD: string;
	LSOA11NM: string;
}

interface LSOAProperties2021 {
	LSOA21CD: string;
	LSOA21NM: string;
}

// Scottish Data Zone properties
// The ONS portal republishes Scottish data zones under the standard code
// spelling; the Scottish Government's own file uses DataZone/Name.
interface DataZoneOnsProperties2011 {
	DZ11CD: string;
	DZ11NM: string;
}

interface DataZoneProperties2011 {
	DataZone: string;
	Name: string;
}

// Country properties by year
interface CountryProperties2020 {
	CTRY20CD: string;
	CTRY20NM: string;
}

interface CountryProperties2021 {
	CTRY21CD: string;
	CTRY21NM: string;
}

interface CountryProperties2022 {
	CTRY22CD: string;
	CTRY22NM: string;
}

interface CountryProperties2023 {
	CTRY23CD: string;
	CTRY23NM: string;
}

interface CountryProperties2024 {
	CTRY24CD: string;
	CTRY24NM: string;
}

interface CountryProperties2025 {
	CTRY25CD: string;
	CTRY25NM: string;
}

// Local planning authority properties by year
interface LocalPlanningAuthorityProperties2019 {
	lpa19cd: string;
	lpa19nm: string;
}

// Region properties by year
interface RegionProperties2025 {
	RGN25CD: string;
	RGN25NM: string;
}

// County and unitary authority properties by year
interface CountyAndUnitaryAuthorityProperties2025 {
	CTYUA25CD: string;
	CTYUA25NM: string;
}

// Integrated care board properties by year
interface IntegratedCareBoardProperties2026 {
	ICB26CD: string;
	ICB26NM: string;
}

// Middle layer super output area properties by year
interface MSOAProperties2021 {
	MSOA21CD: string;
	MSOA21NM: string;
}

interface CommunitySafetyPartnershipProperties2023 {
	CSP23CD: string;
	CSP23NM: string;
}

interface PoliceForceAreaProperties2023 {
	PFA23CD: string;
	PFA23NM: string;
}

interface CombinedAuthorityProperties2025 {
	CAUTH25CD: string;
	CAUTH25NM: string;
}

interface Itl1Properties2021 {
	ITL121CD: string;
	ITL121NM: string;
}

interface Itl2Properties2021 {
	ITL221CD: string;
	ITL221NM: string;
}

interface Itl3Properties2021 {
	ITL321CD: string;
	ITL321NM: string;
}

interface MajorTownAndCityProperties2015 {
	TCITY15CD: string;
	TCITY15NM: string;
}

// NI Super Output Area properties
interface SuperOutputAreaProperties2011 {
	SOA_CODE: string;
	SOA_LABEL: string;
	SOA2011: string;
	SOA: string;
}

// Unified mapping of all boundary types by year
export type YearToProperties = {
	// LSOAs
	lsoa_2011: LSOAProperties2011;
	lsoa_2021: LSOAProperties2021;
	// Scottish Data Zones
	dataZone_2011: DataZoneProperties2011;
	dataZone_ons_2011: DataZoneOnsProperties2011;
	// NI Super Output Areas
	superOutputArea_2011: SuperOutputAreaProperties2011;
	// Wards
	ward_2020: WardProperties2020;
	ward_2021: WardProperties2021;
	ward_2022: WardProperties2022;
	ward_2023: WardProperties2023;
	ward_2024: WardProperties2024;
	ward_2026: WardProperties2026;
	ward_2025: WardProperties2025;
	ward_2019: WardProperties2019;
	ward_2018: WardProperties2018;
	ward_2017: WardProperties2017;
	ward_2016: WardProperties2016;
	// Local Authorities
	lad_2016: LocalAuthorityProperties2016;
	lad_2018: LocalAuthorityProperties2018;
	lad_2021: LocalAuthorityProperties2021;
	lad_2022: LocalAuthorityProperties2022;
	lad_2023: LocalAuthorityProperties2023;
	lad_2024: LocalAuthorityProperties2024;
	lad_2025: LocalAuthorityProperties2025;
	// Constituencies
	constituency_2015: ConstituencyProperties2015;
	constituency_2016: ConstituencyProperties2016;
	constituency_2017: ConstituencyProperties2017;
	constituency_2019: ConstituencyProperties2019;
	constituency_2024: ConstituencyProperties2024;
	// Countries
	country_2020: CountryProperties2020;
	country_2021: CountryProperties2021;
	country_2022: CountryProperties2022;
	country_2023: CountryProperties2023;
	country_2024: CountryProperties2024;
	country_2025: CountryProperties2025;
	// Local planning authorities
	localPlanningAuthority_2019: LocalPlanningAuthorityProperties2019;
	// Regions
	region_2025: RegionProperties2025;
	// Counties and unitary authorities
	countyAndUnitaryAuthority_2025: CountyAndUnitaryAuthorityProperties2025;
	// Integrated care boards
	integratedCareBoard_2026: IntegratedCareBoardProperties2026;
	// Middle layer super output areas
	msoa_2021: MSOAProperties2021;
	communitySafetyPartnership_2023: CommunitySafetyPartnershipProperties2023;
	policeForceArea_2023: PoliceForceAreaProperties2023;
	combinedAuthority_2025: CombinedAuthorityProperties2025;
	itl1_2021: Itl1Properties2021;
	itl2_2021: Itl2Properties2021;
	itl3_2021: Itl3Properties2021;
	majorTownAndCity_2015: MajorTownAndCityProperties2015;
};

export type Properties = ValueOf<YearToProperties>;

type KeysOfUnion<T> = T extends any ? keyof T : never;

export type PropertyKeys = KeysOfUnion<Properties>;

/** A ring of [lon, lat] positions. */
type Ring = number[][];

export type PolygonGeometry = {
	type: "Polygon";
	coordinates: Ring[];
};

export type MultiPolygonGeometry = {
	type: "MultiPolygon";
	coordinates: Ring[][];
};

/**
 * Boundary files carry both shapes: islands and detached parts arrive as
 * MultiPolygon, so callers must discriminate on `type` rather than assume.
 */
export type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;

interface BaseFeature {
	type: "Feature";
	id: number;
	geometry: BoundaryGeometry;
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

/**
 * Safely read a dynamic string property from a GeoJSON feature.
 * The property union (WardProperties*, LADProperties*, etc.) has no index
 * signature, so direct bracket access is a type error. Centralising the cast
 * here keeps all unsafe access in one auditable place.
 */
export function getFeatureProp(
	properties: Properties,
	key: string,
): string | undefined {
	// Double cast needed: no index signature on the property interfaces
	return (properties as unknown as Record<string, string | undefined>)[key];
}

/**
 * The outer ring of each part of a boundary geometry, ignoring holes. Polygon
 * and MultiPolygon nest their positions differently, so callers that only need
 * the outlines should go through here rather than reach into `coordinates`.
 */
export function outerRings(geometry: BoundaryGeometry): number[][][] {
	return geometry.type === "MultiPolygon"
		? geometry.coordinates.map((polygon) => polygon[0])
		: geometry.coordinates.slice(0, 1);
}
