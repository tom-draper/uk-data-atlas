/**
 * The /boundaries page: a fuller explanation of each kind of area, after the
 * one-line introduction the docs share. Releases and area counts come from the
 * catalogue; the reference tests check every geography has an entry.
 */
export const BOUNDARY_DETAILS: Record<string, string> = {
	country:
		"The UK is made up of four nations. Many datasets are published for only some of them, because health, education, housing and other services are run separately in each, and each has its own statistics office.",
	region: "Regions have no elected government of their own, apart from London with its mayor and assembly. They're mainly used to summarise statistics between the national and local level. Wales, Scotland and Northern Ireland are usually shown alongside them as equivalents.",
	countyAndUnitaryAuthority:
		"In two-tier parts of England, a county council runs services such as schools, social care and roads, while smaller district councils handle bins, housing and planning. Elsewhere a single unitary authority does both. This geography lists the upper tier: one area for each county or unitary council.",
	localAuthority:
		"Each local authority district has an elected council responsible for local services. In two-tier areas these are the district councils, in the rest of England they're unitary authorities and metropolitan or London boroughs, and Wales, Scotland and Northern Ireland have their own single-tier councils. Boundaries change from time to time as councils merge, so the Atlas holds several releases.",
	combinedAuthority:
		"A combined authority takes on powers devolved from central government, often over transport, skills and economic development, while the councils within it carry on running everyday services. Most are led by an elected mayor.",
	parish: "Parish and town councils look after very local matters, such as allotments, village halls and play areas, and are consulted on planning. In Wales the equivalent bodies are community councils. Not every part of England has one; the areas without are counted here as unparished.",
	localPlanningAuthority:
		"Anyone applying to build or change a building applies to their local planning authority. Inside a national park, the park authority decides applications instead of the council, which is why these areas differ from council boundaries.",
	nationalPark:
		"National parks protect landscapes of special beauty and wildlife. Each has its own authority that looks after the landscape and acts as the planning authority within its boundary.",
	constituency:
		"Each constituency elects one MP. Boundaries are reviewed periodically so that constituencies hold similar numbers of voters, most recently for the 2024 general election, when almost every constituency changed. Results from different boundary sets can't be compared seat by seat.",
	ward: "Wards are the building blocks of local elections: each elects one or more councillors to its local authority. With several thousand across the UK, they're also small enough to show variation within a town or city, so the Atlas uses them for house prices, population and local election results.",
	countyElectoralDivision:
		"County councils in two-tier areas of England don't use district wards for their elections. They draw their own, larger, divisions, each electing one or two county councillors.",
	scottishParliamentaryConstituency:
		"Scottish Parliament elections give each voter two votes. The first elects a constituency member by first past the post, much like a Westminster election.",
	scottishParliamentaryRegion:
		"The second vote in a Scottish Parliament election is for a party in the voter's region. Seven additional members are elected from each region to make the overall result more proportional.",
	seneddConstituency:
		"Until 2026, Senedd elections, like the Scottish Parliament's, combined constituency members elected by first past the post with regional members. From the 2026 election, Wales uses 16 larger constituencies that each elect six members by proportional representation.",
	seneddElectoralRegion:
		"Each Senedd region elected four additional members, balancing the constituency results to make the overall make-up of the Senedd more proportional. Regions were abolished for the 2026 election.",
	outputArea:
		"Output areas were designed for the census, grouping neighbouring households so that statistics can be published in fine detail without identifying anyone. There are around 190,000 in England and Wales.",
	lsoa: "LSOA stands for lower layer super output area. They're groups of four or five output areas drawn by the Office for National Statistics to be similar in population, about 1,500 people each, and to change as little as possible between censuses. That makes them the go-to areas for comparing small neighbourhoods, and they're the areas the English and Welsh deprivation indices rank. There are about 35,000 in England and Wales.",
	msoa: "MSOA stands for middle layer super output area. Each is made up of a handful of LSOAs, averaging around 8,000 people, so they work well for data that would be too sparse or too sensitive at LSOA level, such as household income estimates. There are about 7,300 in England and Wales.",
	dataZone:
		"Data zones have roughly 500 to 1,000 residents each, and there are around 7,000 across Scotland. They're Scotland's equivalent of LSOAs, so they're the areas to look at for neighbourhood-level statistics in Scotland.",
	intermediateZone:
		"Intermediate zones group data zones together for statistics that are too sparse to publish for individual data zones. There are around 1,300 across Scotland.",
	superOutputArea:
		"Super output areas in Northern Ireland are built from smaller areas and play the same role as LSOAs in England and Wales: small, stable areas of similar population for publishing neighbourhood statistics.",
	itl1: "International Territorial Levels, or ITLs, are the UK's system of statistical regions for comparing economies, which replaced the EU's NUTS regions after Brexit. The ITL1 level is the broadest of three.",
	itl2: "ITL2 areas are mostly counties, groups of counties or city regions, such as Greater Manchester or Devon. There are 46 of them.",
	itl3: "ITL3 areas are mostly single local authorities or small groups of them. There are 182, and they're the most detailed level at which regional GDP is published.",
	travelToWorkArea:
		"Travel to work areas are drawn so that at least three quarters of the people who live in an area also work there, and the other way round. They cross council and county lines wherever commuting does, so they show real local job markets better than administrative areas.",
	majorTownAndCity:
		"These boundaries show where the largest towns and cities actually are on the map, rather than the council areas that contain them, which can include large rural areas.",
	integratedCareBoard:
		"Integrated care boards replaced clinical commissioning groups in 2022. Each one plans and pays for NHS services, such as hospitals and GP surgeries, across its part of England, working with local councils on social care.",
	subIntegratedCareBoardLocation:
		"Sub-ICB locations follow the boundaries of the old clinical commissioning groups, so they let NHS statistics be compared with earlier years at a more local level than a whole integrated care board.",
	nhsEnglandRegion:
		"NHS England oversees the health service through seven regional teams, each covering several integrated care boards.",
	localHealthBoard:
		"NHS Wales is organised into seven local health boards, each responsible for hospitals, GPs and community health services across its area.",
	policeForceArea:
		"Each police force area has its own chief constable and an elected police and crime commissioner, or a mayor in some areas, who sets its priorities and budget. Scotland and Northern Ireland each have a single national police service.",
	communitySafetyPartnership:
		"Every local authority in England and Wales has a community safety partnership, so their boundaries mostly match council areas. Police recorded crime is published on them, which is how the Atlas shows crime by council.",
	fireAndRescueAuthority:
		"Fire and rescue authorities run the fire service for one or more council areas. Some are part of a county council, some are standalone bodies, and in some places the police and crime commissioner or mayor runs them.",
};

/** What a geography's anchor on /boundaries is, beside its docs page. */
export const boundaryAnchor = (slug: string) => `/boundaries#${slug}`;
