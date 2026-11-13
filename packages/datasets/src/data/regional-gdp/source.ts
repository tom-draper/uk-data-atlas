/**
 * One ONS workbook covers all three ITL tiers, and the dataset carries all three
 * as separate partitions rather than mixing them in one total.
 */
export const REGIONAL_GDP_SOURCE = {
	source: "Office for National Statistics",
	sourceUrl:
		"https://www.ons.gov.uk/economy/grossdomesticproductgdp/datasets/regionalgrossdomesticproductallnutslevelregions",
	year: "1998-2023",
	licence: "Open Government Licence v3.0",
	licenceUrl:
		"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
} as const;

export const regionalGdpDescription = (tier: string) =>
	`Balanced gross value added at current basic prices and gross domestic product at current market prices, in £ million, for ${tier}, 1998 to 2023. Extracted from tables 1 and 5 of the published workbook, which restates the whole series on January 2025 ITL codes.`;
