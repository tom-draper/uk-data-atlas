/**
 * The boundary release the atlas draws for each year, for the geographies
 * whose containment and lineage the API compiles for it. The atlas's own
 * boundary catalogue says the same (a test holds the two together); this copy
 * is here so the API can compile the atlas's lookups without reading site
 * code.
 */
export const ATLAS_BOUNDARY_VINTAGES = {
	ward: {
		2011: "2011-12-ew-bgc",
		2015: "2015-12-gb-bgc",
		2016: "2016-12-gb-bgc",
		2017: "2017-12-gb-bgc",
		2018: "2018-12-uk-bgc",
		2019: "2019-12-uk-bgc",
		2020: "2020-12-uk-bgc",
		2021: "2021-12-uk-bgc",
		2022: "2022-12-uk-bgc",
		2023: "2023-12-uk-bgc",
		2024: "2024-12-uk-bgc",
		2025: "2025-05-uk-bgc-v2",
		2026: "2026-05-uk-bgc",
	},
	lsoa: {
		2001: "2001-12-ew-bgc",
		2011: "2011-12-ew-bgc-v3",
		2021: "2021-12-ew-bgc-v5",
	},
	parish: {
		2019: "2019-04-ew-bgc",
		2021: "2021-12-ew-bgc",
		2022: "2022-12-ew-bgc-v3",
		2023: "2023-12-ew-bgc",
		2024: "2024-12-ew-bgc",
		2025: "2025-05-ew-bgc",
		2026: "2026-05-ew-bgc",
	},
	localAuthority: {
		2008: "2008-12-gb-bgc",
		2009: "2009-12-gb-bgc",
		2011: "2011-12-gb-bgc",
		2015: "2015-12-gb-bgc",
		2016: "2016-12-gb-bgc",
		2017: "2017-12-gb-bgc",
		2018: "2018-12-uk-bgc",
		2019: "2019-12-uk-bgc",
		2020: "2020-12-uk-bgc",
		2021: "2021-12-uk-bgc",
		2022: "2022-12-uk-bgc-v2",
		2023: "2023-12-uk-bgc",
		2024: "2024-05-uk-bgc",
		2025: "2025-05-uk-bgc-v2",
		2026: "2026-05-uk-bgc",
	},
	constituency: {
		2010: "2017-12-uk-bgc",
		2015: "2017-12-uk-bgc",
		2016: "2016-12-uk-bgc",
		2017: "2017-12-uk-bgc",
		2018: "2018-12-uk-bgc",
		2019: "2019-12-uk-bgc",
		2020: "2020-12-uk-bgc",
		2021: "2021-12-uk-bgc",
		2022: "2022-12-uk-bgc",
		2024: "2024-07-uk-bgc",
	},
} as const satisfies Record<string, Record<number, string>>;

export type AtlasBoundaryVintages = {
	readonly [Geography in keyof typeof ATLAS_BOUNDARY_VINTAGES]: Readonly<
		Record<number, string>
	>;
};
