/**
 * One ONS workbook covers all three ITL tiers, so the three datasets share
 * this source block and differ only in the geography their records are keyed
 * on. Each tier is its own dataset because each is its own geography; a
 * measure names all three as separate partitions rather than mixing them in
 * one total.
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

/**
 * One name per tier. The workbook is one publication, but each tier is
 * extracted as its own dataset, and a source name identifies the extract that
 * an attribution block credits.
 */
export const regionalGdpName = (tier: string) =>
	`Regional gross domestic product: ${tier} regions`;
