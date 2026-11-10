import type { BoundaryValidity } from "@uk-data-atlas/geography";

/**
 * Evidence-backed inclusive intervals for a specific use. These deliberately
 * cover only dates the evidence establishes; gaps do not mean invalidity.
 */
export const verifiedBoundaryValidity: Readonly<
	Record<string, BoundaryValidity[]>
> = {
	"constituency/2019-12-uk-bgc": [
		{
			purpose: "election_poll",
			validFrom: "2019-12-12",
			validTo: "2019-12-12",
			sourceUrl:
				"https://researchbriefings.files.parliament.uk/documents/CBP-8749/CBP-8749.pdf",
			note: "The December 2019 Westminster constituencies were used for the 12 December 2019 general election. This entry verifies polling day only.",
		},
	],
	"scottishParliamentaryConstituency/2021-05-sc-bgc": [
		{
			purpose: "election_poll",
			validFrom: "2021-05-06",
			validTo: "2021-05-06",
			sourceUrl:
				"https://www.parliament.scot/msps/elections/2021-election-results",
			note: "The May 2021 Scottish parliamentary constituencies were used for the 6 May 2021 election. This entry verifies polling day only.",
		},
	],
	"constituency/2024-07-uk-bgc": [
		{
			purpose: "election_poll",
			validFrom: "2024-07-04",
			validTo: "2024-07-04",
			sourceUrl:
				"https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/methodologies/ukbusinessactivitysizeandlocationqmi",
			note: "The July 2024 UK Westminster constituencies were operative for the 4 July 2024 general election. This entry verifies polling day only.",
		},
	],
	"seneddConstituency/2026-05-w-bgc": [
		{
			purpose: "election_poll",
			validFrom: "2026-05-07",
			validTo: "2026-05-07",
			sourceUrl:
				"https://www.electoralcommission.org.uk/senedd-election-2026-media-guide",
			note: "The 16 new Senedd constituencies were used for the 7 May 2026 Senedd election. This entry verifies polling day only.",
		},
	],
};
