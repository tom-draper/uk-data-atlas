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
			code: [
				"WD25CD",
				"WD24CD",
				"WD23CD",
				"WD22CD",
				"WD21CD",
				"wd19cd",
				"wd18cd",
				"wd17cd",
				"wd16cd",
			],
			name: [
				"WD25NM",
				"WD24NM",
				"WD23NM",
				"WD22NM",
				"WD21NM",
				"wd19nm",
				"wd18nm",
				"wd17nm",
				"wd16nm",
			],
			parentCode: [
				"LAD25CD",
				"LAD24CD",
				"LAD23CD",
				"LAD22CD",
				"LAD21CD",
				"LAD16CD",
				"lad19cd",
				"lad18cd",
				"lad17cd",
				"lad16cd",
			],
		},
		vintages: {
			2025: withCDN(
				"/data/boundaries/ward/2025-05-uk-bgc-v2/boundaries.topojson",
			),
			2024: withCDN(
				"/data/boundaries/ward/2024-12-uk-bgc/boundaries.topojson",
			),
			2023: withCDN(
				"/data/boundaries/ward/2023-12-uk-bgc/boundaries.topojson",
			),
			2022: withCDN(
				"/data/boundaries/ward/2022-12-uk-bgc/boundaries.topojson",
			),
			2021: withCDN(
				"/data/boundaries/ward/2021-12-uk-bgc/boundaries.topojson",
			),
			2019: withCDN(
				"/data/boundaries/ward/2019-12-gb-bgc/boundaries.topojson",
			),
			2018: withCDN(
				"/data/boundaries/ward/2018-12-uk-bgc/boundaries.topojson",
			),
			2017: withCDN(
				"/data/boundaries/ward/2017-12-gb-bgc/boundaries.topojson",
			),
			2016: withCDN(
				"/data/boundaries/ward/2016-12-gb-bgc/boundaries.topojson",
			),
		},
	},
	constituency: {
		properties: {
			code: ["PCON24CD", "pcon19cd", "PCON17CD", "PCON15CD"],
			name: ["PCON24NM", "pcon19nm", "PCON17NM", "PCON15NM"],
		},
		vintages: {
			// The 2010–2019 boundary set did not change. The existing 2017 geometry
			// therefore also supplies the code-compatible 2010 election map.
			2010: withCDN(
				"/data/boundaries/constituency/2017-12-uk-bgc/boundaries.topojson",
			),
			2024: withCDN(
				"/data/boundaries/constituency/2024-07-uk-bgc/boundaries.topojson",
			),
			2019: withCDN(
				"/data/boundaries/constituency/2019-12-uk-bgc/boundaries.topojson",
			),
			2017: withCDN(
				"/data/boundaries/constituency/2017-12-uk-bgc/boundaries.topojson",
			),
			2015: withCDN(
				"/data/boundaries/constituency/2017-12-uk-bgc/boundaries.topojson",
			),
		},
	},
	localAuthority: {
		properties: {
			code: [
				"LAD25CD",
				"LAD24CD",
				"LAD23CD",
				"LAD22CD",
				"LAD21CD",
				"LAD16CD",
			],
			name: [
				"LAD25NM",
				"LAD24NM",
				"LAD23NM",
				"LAD22NM",
				"LAD21NM",
				"LAD16NM",
			],
		},
		vintages: {
			2025: withCDN(
				"/data/boundaries/local-authority/2025-05-uk-bgc-v2/boundaries.topojson",
			),
			2024: withCDN(
				"/data/boundaries/local-authority/2024-05-uk-bgc/boundaries.topojson",
			),
			2023: withCDN(
				"/data/boundaries/local-authority/2023-05-uk-bgc-v2/boundaries.topojson",
			),
			2016: withCDN(
				"/data/boundaries/local-authority/2016-12-gb-bgc/boundaries.topojson",
			),
		},
	},
	lsoa: {
		properties: {
			code: ["LSOA11CD", "LSOA21CD"],
			name: ["LSOA11NM", "LSOA21NM"],
		},
		vintages: {
			2011: withCDN(
				"/data/boundaries/lsoa/2011-12-ew-bgc-v3/boundaries.topojson",
			),
		},
	},
	dataZone: {
		properties: { code: ["DataZone"], name: ["Name"] },
		vintages: {
			2011: withCDN(
				"/data/boundaries/data-zone/2011-12-sc-bfc/boundaries.topojson",
			),
		},
	},
	superOutputArea: {
		properties: {
			code: ["SOA_CODE", "SOA2011", "SOA"],
			name: ["SOA_LABEL", "SOA2011 Name", "SOA Name"],
		},
		vintages: {
			2011: withCDN(
				"/data/boundaries/super-output-area/2011-ni/boundaries.topojson",
			),
		},
	},
} as const satisfies Record<string, BoundaryFamily>;

export type BoundaryType = keyof typeof BOUNDARY_CATALOG;
export type BoundaryYear<T extends BoundaryType> =
	keyof (typeof BOUNDARY_CATALOG)[T]["vintages"];

/** Every geography in catalogue order, for callers that handle all of them. */
export const BOUNDARY_TYPES = Object.keys(BOUNDARY_CATALOG) as BoundaryType[];

/** The vintages a geography has boundary files for, newest first. */
export const boundaryYears = (type: BoundaryType): number[] =>
	Object.keys(BOUNDARY_CATALOG[type].vintages)
		.map(Number)
		.sort((a, b) => b - a);

// The catalogue lists each geography's code keys and name keys in step, so a
// file's code property identifies both its geography and its matching name key.
const CODE_KEY_INDEX = new Map<string, { type: BoundaryType; nameKey: string }>(
	BOUNDARY_TYPES.flatMap((type) => {
		const { code, name } = BOUNDARY_CATALOG[type].properties;
		return code.map(
			(key, index) =>
				[key, { type, nameKey: name[index] ?? name[0] }] as const,
		);
	}),
);

/** The geography a boundary file belongs to, from the code property it carries. */
export const boundaryTypeForCodeKey = (
	codeKey: string,
): BoundaryType | undefined => CODE_KEY_INDEX.get(codeKey)?.type;

/** The name property paired with a code property in the same boundary file. */
export const nameKeyForCodeKey = (codeKey: string): string | undefined =>
	CODE_KEY_INDEX.get(codeKey)?.nameKey;
