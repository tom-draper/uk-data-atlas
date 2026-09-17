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
 * ITL2 code inside an ITL1 code. They are registered as separate datasets
 * because each is a different geography, and a measure names all three as
 * separate source partitions rather than mixing tiers in one total.
 */
export interface RegionalGdpAreaData {
	itlCode: string;
	itlName: string;
	/** Gross value added (balanced) at current basic prices, £ million. */
	gvaMillionGbp: number;
	/** Gross domestic product at current market prices, £ million. */
	gdpMillionGbp: number;
}

interface RegionalGdpDataset<Type extends string, Boundary extends string> {
	id: string;
	type: Type;
	year: number;
	boundaryType: Boundary;
	boundaryYear: number;
	data: Record<string, RegionalGdpAreaData>;
}

export type RegionalGdpItl1Dataset = RegionalGdpDataset<
	"regionalGdpItl1",
	"itl1"
>;
export type RegionalGdpItl2Dataset = RegionalGdpDataset<
	"regionalGdpItl2",
	"itl2"
>;
export type RegionalGdpItl3Dataset = RegionalGdpDataset<
	"regionalGdpItl3",
	"itl3"
>;
