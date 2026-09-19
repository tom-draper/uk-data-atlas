/**
 * The geography pages: a friendly name and explanation for each kind of area
 * the Atlas holds boundaries for. Releases, area counts and the data on each
 * are generated from the catalogue; the docs tests check every geography in
 * the boundary registry has an entry here.
 */

export interface GeographyGroup {
	id: string;
	title: string;
}

export interface GeographyContent {
	slug: string;
	title: string;
	group: string;
	intro: string;
}

export const GEOGRAPHY_GROUPS: GeographyGroup[] = [
	{ id: "administrative", title: "Councils and regions" },
	{ id: "electoral", title: "Elections" },
	{ id: "statistical", title: "Statistical areas" },
	{ id: "services", title: "Health, police and fire" },
];

export const GEOGRAPHIES: Record<string, GeographyContent> = {
	country: {
		slug: "countries",
		title: "Countries",
		group: "administrative",
		intro: "England, Wales, Scotland and Northern Ireland.",
	},
	region: {
		slug: "regions",
		title: "Regions",
		group: "administrative",
		intro: "The nine regions of England, such as the North West and London. Many national statistics are summarised at this level.",
	},
	countyAndUnitaryAuthority: {
		slug: "counties-and-unitary-authorities",
		title: "Counties and unitary authorities",
		group: "administrative",
		intro: "The upper tier of local government: county councils, unitary authorities, and metropolitan and London boroughs.",
	},
	localAuthority: {
		slug: "local-authorities",
		title: "Local authorities",
		group: "administrative",
		intro: "Local authority districts, the councils that run local services, such as Leeds, Cornwall or Glasgow City. They're the most common geography for official statistics, and most data in the Atlas is published on them.",
	},
	combinedAuthority: {
		slug: "combined-authorities",
		title: "Combined authorities",
		group: "administrative",
		intro: "Groups of English councils that work together under a mayor or a combined county authority, such as Greater Manchester or the West Midlands.",
	},
	parish: {
		slug: "parishes",
		title: "Parishes",
		group: "administrative",
		intro: "Civil parishes and Welsh communities, the smallest tier of local government, together with the unparished areas between them, so they cover England and Wales completely.",
	},
	localPlanningAuthority: {
		slug: "local-planning-authorities",
		title: "Local planning authorities",
		group: "administrative",
		intro: "The bodies that decide planning applications. Mostly councils, but also national park authorities and development corporations.",
	},
	nationalPark: {
		slug: "national-parks",
		title: "National parks",
		group: "administrative",
		intro: "The fifteen national parks of England, Wales and Scotland.",
	},
	constituency: {
		slug: "westminster-constituencies",
		title: "Westminster constituencies",
		group: "electoral",
		intro: "The areas that each elect a Member of Parliament to the House of Commons. The Atlas holds release history from 2015, including boundaries from before and after the 2024 general-election redraw.",
	},
	ward: {
		slug: "wards",
		title: "Wards",
		group: "electoral",
		intro: "Electoral wards, the areas that elect local councillors. They're redrawn often, so the Atlas holds a range of historical releases from 2011 onward.",
	},
	countyElectoralDivision: {
		slug: "county-electoral-divisions",
		title: "County electoral divisions",
		group: "electoral",
		intro: "The areas English county councils are elected by, the county council equivalent of wards.",
	},
	scottishParliamentaryConstituency: {
		slug: "scottish-parliament-constituencies",
		title: "Scottish Parliament constituencies",
		group: "electoral",
		intro: "The 73 constituencies that each elect a member of the Scottish Parliament.",
	},
	scottishParliamentaryRegion: {
		slug: "scottish-parliament-regions",
		title: "Scottish Parliament regions",
		group: "electoral",
		intro: "The eight regions that elect the Scottish Parliament's additional members.",
	},
	seneddConstituency: {
		slug: "senedd-constituencies",
		title: "Senedd constituencies",
		group: "electoral",
		intro: "The 40 constituencies that each elect a member of the Senedd, the Welsh Parliament.",
	},
	seneddElectoralRegion: {
		slug: "senedd-regions",
		title: "Senedd regions",
		group: "electoral",
		intro: "The five regions that elect the Senedd's additional members.",
	},
	lsoa: {
		slug: "lsoas",
		title: "Lower layer super output areas (LSOAs)",
		group: "statistical",
		intro: "Small neighbourhoods of around 1,000 to 3,000 people in England and Wales, designed for statistics. Deprivation indices and other small-area data are published on them.",
	},
	msoa: {
		slug: "msoas",
		title: "Middle layer super output areas (MSOAs)",
		group: "statistical",
		intro: "Areas of around 5,000 to 15,000 people in England and Wales, built from LSOAs and sitting between them and local authorities.",
	},
	dataZone: {
		slug: "data-zones",
		title: "Data zones",
		group: "statistical",
		intro: "Scotland's small areas for statistics, similar to LSOAs in England and Wales. The Scottish Index of Multiple Deprivation is published on them.",
	},
	superOutputArea: {
		slug: "northern-ireland-super-output-areas",
		title: "Northern Ireland super output areas",
		group: "statistical",
		intro: "Northern Ireland's small areas for statistics. The Northern Ireland Multiple Deprivation Measure is published on them.",
	},
	itl1: {
		slug: "itl1",
		title: "ITL1 regions",
		group: "statistical",
		intro: "The top tier of International Territorial Levels, used for regional economic statistics: the nine English regions plus Wales, Scotland and Northern Ireland.",
	},
	itl2: {
		slug: "itl2",
		title: "ITL2 areas",
		group: "statistical",
		intro: "The middle tier of International Territorial Levels, used for regional economic statistics.",
	},
	itl3: {
		slug: "itl3",
		title: "ITL3 areas",
		group: "statistical",
		intro: "The most detailed tier of International Territorial Levels, where regional GDP and productivity are published.",
	},
	travelToWorkArea: {
		slug: "travel-to-work-areas",
		title: "Travel to work areas",
		group: "statistical",
		intro: "Areas where most residents also work, drawn from commuting patterns rather than administrative lines. They're a good approximation of local labour markets.",
	},
	majorTownAndCity: {
		slug: "major-towns-and-cities",
		title: "Major towns and cities",
		group: "statistical",
		intro: "The built-up extents of the largest towns and cities in England and Wales. Useful for giving a map context, rather than for joining data to.",
	},
	integratedCareBoard: {
		slug: "integrated-care-boards",
		title: "Integrated care boards",
		group: "services",
		intro: "The NHS bodies that plan health services across England. NHS waiting times are reported on them.",
	},
	subIntegratedCareBoardLocation: {
		slug: "sub-icb-locations",
		title: "Sub-ICB locations",
		group: "services",
		intro: "The areas within each integrated care board, which took over from clinical commissioning groups.",
	},
	nhsEnglandRegion: {
		slug: "nhs-england-regions",
		title: "NHS England regions",
		group: "services",
		intro: "The seven regions NHS England is organised into, above the integrated care boards.",
	},
	localHealthBoard: {
		slug: "local-health-boards",
		title: "Welsh local health boards",
		group: "services",
		intro: "The seven boards that plan and deliver NHS services in Wales.",
	},
	policeForceArea: {
		slug: "police-force-areas",
		title: "Police force areas",
		group: "services",
		intro: "The 43 territorial police forces of England and Wales.",
	},
	communitySafetyPartnership: {
		slug: "community-safety-partnerships",
		title: "Community safety partnerships",
		group: "services",
		intro: "Local partnerships of councils, police and other services that tackle crime. Police recorded crime is published on them, so they're the geography for the Atlas's crime data.",
	},
	fireAndRescueAuthority: {
		slug: "fire-and-rescue-authorities",
		title: "Fire and rescue authorities",
		group: "services",
		intro: "The 47 fire and rescue services of England and Wales.",
	},
};
