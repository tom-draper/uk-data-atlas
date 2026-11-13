/**
 * Regional economic output on the International Territorial Level geography,
 * as ONS publishes it: one balanced set of estimates for all three ITL tiers,
 * restated on the January 2025 codes with every release rather than each year
 * carrying the boundaries in force at the time.
 *
 * GVA and GDP are both money totals for an area, so both add up over areas and
 * both are published here. They are not the same quantity: GDP is GVA plus
 * taxes on products less subsidies on them, which the publisher allocates
 * regionally, so a GDP total is the one comparable with national accounts.
 *
 * The three tiers are a hierarchy, not one table: an ITL3 code sits inside an
 * ITL2 code inside an ITL1 code. They are one dataset with the tier as its
 * geography, and a measure names all three as separate source partitions
 * rather than mixing tiers in one total.
 */
export interface RegionalGdpAreaData {
	itlCode: string;
	itlName: string;
	/** Gross value added (balanced) at current basic prices, £ million. */
	gvaMillionGbp: number;
	/** Gross domestic product at current market prices, £ million. */
	gdpMillionGbp: number;
}

export type RegionalGdpMetrics = Pick<
	RegionalGdpAreaData,
	"gvaMillionGbp" | "gdpMillionGbp"
>;

/** GDP and GVA summed across the selected ITL3 areas. */
export type AggregatedRegionalGdpData = RegionalGdpMetrics;

/** One tier and year of the series. The tier is the dataset's geography. */
export interface RegionalGdpDataset {
	id: string;
	type: "regional-gdp";
	year: number;
	boundaryType: "itl1" | "itl2" | "itl3";
	boundaryYear: number;
	data: Record<string, RegionalGdpAreaData>;
}
