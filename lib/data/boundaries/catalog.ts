import { withCDN } from "@/lib/helpers/cdn";

type BoundaryProperties = {
	code: readonly string[];
	name: readonly string[];
	parentCode?: readonly string[];
};

type BoundaryFamily = {
	properties: BoundaryProperties;
	vintages: Record<number, string>;
};

/**
 * Authoritative catalogue of the boundary files supported by the atlas.
 *
 * Add a geography or vintage here first. The path, recognised feature
 * properties, and all derived public boundary metadata are kept together so
 * callers cannot accidentally update one without the others.
 */
export const BOUNDARY_CATALOG = {
	ward: {
		properties: {
			code: ["WD25CD", "WD24CD", "WD23CD", "WD22CD", "WD21CD"],
			name: ["WD25NM", "WD24NM", "WD23NM", "WD22NM", "WD21NM"],
			parentCode: ["LAD25CD", "LAD24CD", "LAD23CD", "LAD22CD", "LAD21CD", "LAD16CD"],
		},
		vintages: {
			2025: withCDN("/data/boundaries/wards/WD_MAY_2025_UK_BGC_V2_-8581021362622909866.topojson"),
			2024: withCDN("/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.topojson"),
			2023: withCDN("/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.topojson"),
			2022: withCDN("/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.topojson"),
			2021: withCDN("/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.topojson"),
		},
	},
	constituency: {
		properties: {
			code: ["PCON24CD", "pcon19cd", "PCON17CD", "PCON15CD"],
			name: ["PCON24NM", "pcon19nm", "PCON17NM", "PCON15NM"],
		},
		vintages: {
			2024: withCDN("/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.topojson"),
			2019: withCDN("/data/boundaries/constituencies/WPC_Dec_2019_GCB_UK_2022_-6554439877584414509.topojson"),
			2017: withCDN("/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.topojson"),
			2015: withCDN("/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.topojson"),
		},
	},
	localAuthority: {
		properties: {
			code: ["LAD25CD", "LAD24CD", "LAD23CD", "LAD22CD", "LAD21CD", "LAD16CD"],
			name: ["LAD25NM", "LAD24NM", "LAD23NM", "LAD22NM", "LAD21NM", "LAD16NM"],
		},
		vintages: {
			2025: withCDN("/data/boundaries/lad/LAD_MAY_2025_UK_BGC_V2_1110015208521213948.topojson"),
			2024: withCDN("/data/boundaries/lad/Local_Authority_Districts_May_2024_Boundaries_UK_BGC_-6307115499537197728.topojson"),
			2023: withCDN("/data/boundaries/lad/Local_Authority_Districts_May_2023_UK_BGC_V2_606764927733448598.topojson"),
			2016: withCDN("/data/boundaries/lad/LAD_Dec_2016_GB_BGC_WGS84.topojson"),
		},
	},
	lsoa: {
		properties: { code: ["LSOA11CD", "LSOA21CD"], name: ["LSOA11NM", "LSOA21NM"] },
		vintages: { 2011: withCDN("/data/boundaries/lsoa/LSOA_Dec_2011_Boundaries_Generalised_Clipped_BGC_EW_V3_1201710622178571867.topojson") },
	},
	dataZone: {
		properties: { code: ["DataZone"], name: ["Name"] },
		vintages: { 2011: withCDN("/data/boundaries/datazone/SG_DataZone_Bdry_2011.topojson") },
	},
	superOutputArea: {
		properties: { code: ["SOA_CODE", "SOA2011", "SOA"], name: ["SOA_LABEL", "SOA2011 Name", "SOA Name"] },
		vintages: { 2011: withCDN("/data/boundaries/superOutputArea/NI_SOA_2011.topojson") },
	},
} as const satisfies Record<string, BoundaryFamily>;

export type BoundaryType = keyof typeof BOUNDARY_CATALOG;
export type BoundaryYear<T extends BoundaryType> = keyof (typeof BOUNDARY_CATALOG)[T]["vintages"];
