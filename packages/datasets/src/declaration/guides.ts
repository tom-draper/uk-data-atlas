import type { DatasetTopic } from "./taxonomy.ts";

/**
 * The words about each dataset that its declaration does not carry, keyed by
 * the dataset's public id: the docs and `/datasets` pages read them, in the
 * theme and topic order of the registry. The topic repeats the declaration's
 * (census tables and fuel poverty have none), and a test checks they agree.
 */
export interface DatasetGuide {
	/** The dataset's name on the docs and `/datasets` pages. */
	title: string;
	/** The one topic the dataset is filed under. */
	topic: DatasetTopic;
	/**
	 * Other topics the dataset is also listed under, as in its declaration
	 * (a test checks they agree). They only affect discovery: the primary
	 * topic decides the theme, module, source path and builds.
	 */
	related?: readonly DatasetTopic[];
	/** A plain explanation of what the dataset measures. */
	about: string;
	/**
	 * What the data is and why you'd use it, with the Atlas legend and
	 * regional summary behaviour, for the docs. Defaults to `about`.
	 */
	summary?: string;
	/**
	 * The geography the publisher released it for, when the Atlas maps it on
	 * another: crime is published for community safety partnerships and drawn
	 * on their councils.
	 */
	publishedOn?: string;
}

export const DATASET_GUIDES: Readonly<Record<string, DatasetGuide>> = {
	"census-2021-ts001": {
		title: "Census 2021 usual residents by residence type",
		topic: "population-estimates",
		about: "How many usual residents lived in households and in communal establishments such as care homes and student halls on Census Day 2021, for small areas in England and Wales.",
		summary:
			"Census 2021 counts of usual residents in England and Wales, split between people living in households and in communal establishments, for lower and middle layer super output areas.",
	},
	"census-2021-ts003": {
		title: "Census 2021 household composition",
		topic: "population-estimates",
		about: "How many households of each type, such as one person, couples or lone parents, there were in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of households in England and Wales by composition, for lower and middle layer super output areas.",
	},
	"census-2021-ts007a": {
		title: "Census 2021 age in five-year bands",
		topic: "population-estimates",
		about: "How many residents of each five-year age band lived in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of residents in England and Wales by age, in five-year bands, for lower and middle layer super output areas.",
	},
	population: {
		title: "Population",
		topic: "population-estimates",
		about: "Population estimates for the much smaller electoral wards of England and Wales, broken down by age and sex. The Atlas uses it for its population density, age and gender maps, which show how people are spread within a council area rather than across the country.",
		summary:
			"Official population estimates for wards in England and Wales, through mid-2022. Newer ONS ward estimates, on May 2025 boundaries, are not in the Atlas yet. Population density is included too.",
	},
	"population-constituency": {
		title: "Population (Constituency)",
		topic: "population-estimates",
		about: "How many people live in each Westminster constituency in England and Wales, on the boundaries used from the 2024 general election onwards. Useful for putting election results and other constituency figures in context.",
		summary:
			"Official population estimates for the Westminster constituencies first contested in 2024.",
	},
	"population-uk": {
		title: "Population (Local Authority)",
		topic: "population-estimates",
		about: "How many people live in each local authority across the UK, estimated every year by the Office for National Statistics between censuses. It's the standard yardstick for comparing places of different sizes, and many per-person figures in the Atlas are worked out from it.",
		summary:
			"Official population estimates from the Office for National Statistics: every UK local authority each year since 2011. Population density is included too.",
	},
	"census-2021-ts021": {
		title: "Census 2021 ethnic group",
		topic: "ethnicity-and-identity",
		about: "How many residents of each ethnic group lived in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of residents in England and Wales by ethnic group, for lower and middle layer super output areas.",
	},
	ethnicity: {
		title: "Ethnicity",
		topic: "ethnicity-and-identity",
		about: "The ethnic groups residents identified with in the 2021 Census, for every local authority in England and Wales. It shows how the make-up of the population differs from place to place.",
		summary:
			"How many residents of each local authority in England and Wales belong to each of the nineteen ethnic groups recorded in Census 2021.",
	},
	"census-2021-ts066": {
		title: "Census 2021 economic activity status",
		topic: "labour-market",
		about: "What residents aged 16 and over in small areas of England and Wales were doing in the week before Census Day 2021: working, looking for work or economically inactive.",
		summary:
			"Census 2021 counts of residents aged 16 and over in England and Wales by economic activity, for lower and middle layer super output areas.",
	},
	"claimant-count": {
		title: "Claimant Count",
		topic: "labour-market",
		about: "The share of working-age residents claiming unemployment-related benefits, Universal Credit or Jobseeker's Allowance, in each local authority. It's published monthly, so it's the most up-to-date local view of unemployment.",
		summary:
			"How many people in each local authority count as claimants of Universal Credit or Jobseeker's Allowance, in total and for 16 to 24 year olds.",
	},
	jobs: {
		title: "Jobs",
		topic: "labour-market",
		about: "How many jobs are based in each local authority, counted where people work rather than where they live. Places with large city centres or business parks can have more jobs than residents.",
		summary:
			"The total number of jobs in each local authority from 2011 to 2024, counted where people work rather than where they live.",
	},
	unemployment: {
		title: "Unemployment",
		topic: "labour-market",
		about: "Estimates of the share of economically active people who are out of work and looking for a job, modelled for each local authority from survey data. The series ended in 2022.",
		summary:
			"The ONS's final model-based estimates of unemployment for local authorities in Great Britain, from 1996 to 2021, as a rate and a count, with confidence intervals. ONS discontinued this series in August 2022.",
	},
	income: {
		title: "Income",
		topic: "earnings-and-income",
		about: "Pay for employees who live in each local authority in England, from the Annual Survey of Hours and Earnings. Select annual or hourly pay and median or mean. The median is the middle value, so a few very high earners don't skew it. Regional hourly figures average the available authority estimates without population weighting.",
		summary:
			"Median and mean annual and hourly pay for employees in each English local authority, by where workers live. The income legend switches between annual and hourly pay and between median and mean. Regional cards show an unweighted average of the available authority estimates, rather than a pooled regional median or mean.",
	},
	"workplace-income": {
		title: "Workplace income",
		topic: "earnings-and-income",
		about: "Pay for jobs based in each local authority in England, whoever does them. Enable the Workplace Pay card and select annual or hourly pay, median or mean. Regional figures average the available authority estimates without population weighting. Compare it with the resident Income card to see differences between where people work and live.",
		summary:
			"Median and mean annual and hourly pay for employees in each English local authority, by where their jobs are located. Enable the Workplace Pay card to map earnings where jobs are located. Its legend offers annual or hourly median and mean pay, separately from the resident Income card. Regional workplace figures average available authority estimates; suppressed estimates remain unavailable.",
	},
	"business-activity": {
		title: "UK business: activity, size and location",
		topic: "business",
		about: "How many businesses are based in each local authority, counting those registered for VAT or running a PAYE payroll. It gives a sense of the size and spread of local economies.",
		summary:
			"VAT and/or PAYE based enterprises in each UK local authority, published by broad industry group.",
	},
	"regional-gdp": {
		title: "Regional gross domestic product",
		topic: "economic-output",
		about: "The size of the economy in each UK region, measured as gross domestic product and gross value added. These figures underpin comparisons of regional prosperity.",
		summary:
			"Gross domestic product and gross value added for every UK region at all three tiers of the International Territorial Level geography, from 1998 to 2023. ITL1 is the top tier, ITL2 the middle and ITL3 the most detailed, mostly individual or paired local authorities. Output is counted where it is produced, not where the people who earn it live. Use the map legend to switch between GDP at market prices and GVA at basic prices. Both measures are monetary totals, summed across selected ITL3 areas.",
	},
	"local-government-finance": {
		title: "Local authority revenue expenditure and financing",
		topic: "public-finance",
		about: "What English councils plan to spend on their services this financial year, from their budget returns to government. The Atlas maps spending on education services.",
		summary: "English local-authority revenue budgets.",
	},
	"house-price": {
		title: "House Prices",
		topic: "prices-and-affordability",
		about: "The prices homes sold for in each ward of England and Wales, based on Land Registry sales records, going back to 1995. The Atlas shows the median price, the price in the middle of all sales.",
		summary:
			"Median prices paid for homes in every ward in England and Wales, for each year from 1995 to 2022. This was the final ONS ward-level edition, and its partial 2023 is left out because it isn't comparable.",
	},
	"housing-affordability": {
		title: "House price to residence-based earnings ratio",
		topic: "prices-and-affordability",
		related: ["earnings-and-income"],
		about: "How many years of typical local earnings it would take to buy a typical home in each local authority. A ratio of 10 means the median home costs ten times the median full-time salary of residents.",
	},
	"census-2021-ts054": {
		title: "Census 2021 tenure",
		topic: "housing-stock",
		about: "How many households owned, rented or lived rent free in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of households in England and Wales by tenure, for lower and middle layer super output areas. Enable the Housing Tenure card to map Census 2021 LSOA percentages in England and Wales. The legend selects a category. Regional percentages divide summed category counts by summed household counts.",
	},
	"council-tax": {
		title: "Council Tax levels in England",
		topic: "housing-stock",
		related: ["public-finance"],
		about: "The average Band D council tax bill in each English council area, including precepts for police, fire and parish councils. Band D is the standard band used to compare council tax between areas.",
		summary:
			"The council tax levels billing authorities in England set for 2026-27.",
	},
	"housing-tenure": {
		title: "Housing tenure",
		topic: "housing-stock",
		about: "Census 2021 household tenure for LSOAs in England and Wales. The legend selects owned, owned outright, owned with a mortgage or loan, shared ownership, social rent, private rent or rent free. Regional percentages divide summed category household counts by summed total households.",
	},
	"net-additional-dwellings": {
		title: "Housing supply: net additional dwellings",
		topic: "housing-stock",
		about: "How much the number of homes in each English local authority grew over the year, counting new builds and conversions, minus demolitions. It's the government's main measure of housing supply.",
		summary: "New homes added by English local authorities.",
	},
	"planning-applications": {
		title: "Planning applications in England",
		topic: "planning",
		about: "How many planning applications each local planning authority in England received in a quarter, from house extensions to major developments.",
		summary:
			"Planning applications received by English local authorities. The planning legend switches between applications received, decided and withdrawn during 2026 Q1. Outstanding counts are unavailable in this release. Regional cards sum available authority counts; suppressed measures remain unavailable.",
	},
	homelessness: {
		title: "Temporary Accommodation",
		topic: "homelessness",
		about: "How many households in each English council area are living in temporary accommodation, such as hostels or bed and breakfasts, while they wait for a settled home. Rates are shown per 1,000 households.",
		summary:
			"Households living in temporary accommodation in each English local authority, including households with children and the number of children.",
	},
	"census-2021-ts037": {
		title: "Census 2021 general health",
		topic: "health-status",
		about: "How residents of small areas in England and Wales rated their own general health in the 2021 Census, from very good to very bad.",
		summary:
			"Census 2021 counts of residents in England and Wales by self-assessed general health, for lower and middle layer super output areas. Enable the General health card to map resident health categories; its regional percentages divide summed category counts by summed resident counts.",
	},
	"general-health": {
		title: "General health",
		topic: "health-status",
		about: "Self-reported general health in Census 2021 for LSOAs in England and Wales. The legend selects good or very good health, each separate good-health category, fair, bad or very bad health. Regional percentages divide summed resident category counts by summed total residents. These are crude percentages and do not adjust for differences in age.",
	},
	"public-health": {
		title: "Public health indicators",
		topic: "health-status",
		about: "Enable the Public Health card to compare smoking, adult overweight including obesity, physical activity, childhood excess weight and preventable mortality under 75. Figures cover persons in English counties and unitary authorities. Smoking and mortality use 2024, and the other measures use 2024/25. Regional summaries average available authority estimates without population weighting. Mortality is age-standardised per 100,000. Missing estimates remain unavailable.",
	},
	"life-expectancy": {
		title: "Life Expectancy",
		topic: "life-expectancy",
		about: "How long a baby born today could expect to live, and how many of those years in good health, if current death rates held. Figures are averaged over three years for each local area, and are one of the clearest measures of health inequality between places.",
	},
	"life-expectancy-series": {
		title: "Life Expectancy Series",
		topic: "life-expectancy",
		about: "Life expectancy at birth for men and women in each local area, going back to the early 2000s. It shows how the gap between places has changed over two decades, with confidence intervals so small differences aren't over-read.",
		summary:
			"Life expectancy at birth for men and women in local authorities across the UK, for every three-year period since 2001 to 2003, with confidence intervals. The map legend switches between life expectancy and healthy life expectancy, while retaining the male, female or average selection. Healthy life expectancy estimates the years lived in good health and uses its own scale and coverage. The separate Healthy Life Expectancy card is also available in the chart picker.",
	},
	"nhs-waiting": {
		title: "NHS Waiting Times",
		topic: "nhs-services",
		about: "How long patients in England have been waiting for planned hospital treatment after a GP referral. Waits are reported for each integrated care board, the NHS body that plans services for an area.",
		publishedOn: "integratedCareBoard",
	},
	"adult-social-care-activity": {
		title: "Adult social care activity in England",
		topic: "social-care",
		about: "How many adults receive long-term social care support from their council in England, such as care at home or in a care home, split between working-age adults and people aged 65 and over.",
		summary: "Adult social care activity reported by English councils.",
	},
	"adult-social-care-outcomes": {
		title: "Adult Social Care Outcomes Framework, England",
		topic: "social-care",
		about: "How people who use adult social care in England rate their quality of life, scored out of 24 from a national survey. It's one of the main ways the government compares how well council care services work.",
		summary:
			"The care-related quality-of-life outcome score reported by English councils.",
	},
	"pupil-absence": {
		title: "Pupil absence",
		topic: "schools",
		about: "Full-year 2024/25 pupil absence in English state-funded primary, secondary and special schools, mapped on county and unitary authority boundaries. Overall, authorised and unauthorised measures divide missed sessions by possible sessions. Persistent and severe absence count enrolments missing at least 10% and 50% of sessions. Regional rates divide summed counts by the corresponding summed denominators.",
	},
	"school-performance": {
		title: "School Performance (KS4)",
		topic: "schools",
		about: "GCSE results for state-funded schools in England, grouped by local authority and, for the latest two years, by Westminster constituency. It includes Attainment 8, the average grade across a pupil's best eight subjects, and Progress 8, how much progress pupils made compared with others who started secondary school at a similar level.",
	},
	"school-performance-disadvantage": {
		title: "Attainment 8 Gap",
		topic: "schools",
		about: "How far disadvantaged pupils in each English local authority trail their classmates at GCSE. Disadvantaged pupils are those eligible for free school meals in recent years or who have been in care.",
	},
	qualification: {
		title: "Qualifications",
		topic: "qualifications",
		about: "The highest qualification held by residents aged 16 and over in the 2021 Census, from no qualifications up to degree level. The Atlas maps the share of residents with a degree or equivalent.",
		summary:
			"The highest qualification held by residents aged 16 and over in each local authority in England and Wales, from Census 2021.",
	},
	imd: {
		title: "Indices of Multiple Deprivation",
		topic: "deprivation",
		about: "The English Indices of Deprivation rank every small neighbourhood in England from most to least deprived, combining income, employment, education, health, crime, housing and living environment. It's the standard way to find the most deprived areas in England.",
		summary:
			"The English Indices of Deprivation, ranking small neighbourhoods from most to least deprived. The legend switches between the overall index and its seven domain scores. Income and employment scores are rates; health and crime scores can be negative. Each domain uses its own scale. Area summaries show population-weighted scores, and domain views do not imply domain deciles.",
	},
	nimdm: {
		title: "Northern Ireland Multiple Deprivation Measure",
		topic: "deprivation",
		about: "Northern Ireland's measure of deprivation, ranking each of its small areas from most to least deprived across income, employment, health, education, access to services, living environment and crime.",
		summary:
			"The Northern Ireland Multiple Deprivation Measure, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	simd: {
		title: "Scottish Index of Multiple Deprivation",
		topic: "deprivation",
		about: "Scotland's index of deprivation, ranking each of its small areas, called data zones, from most to least deprived. It's widely used to target funding and services in Scotland.",
		summary:
			"The Scottish Index of Multiple Deprivation, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	wimd: {
		title: "Welsh Index of Multiple Deprivation",
		topic: "deprivation",
		about: "Wales's own index of deprivation, ranking every small neighbourhood in Wales across income, employment, health, education, access to services, housing, community safety and environment. Its ranks can't be compared directly with England's.",
		summary:
			"The Welsh Index of Multiple Deprivation, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	"child-poverty": {
		title: "Child Poverty",
		topic: "poverty",
		about: "The share of children under 16 in each local authority living in families on relatively low incomes, below 60% of the UK median, before housing costs. It's the government's main local measure of child poverty.",
	},
	"fuel-poverty": {
		title: "Fuel Poverty",
		topic: "poverty",
		related: ["energy"],
		about: "The share of households in each small neighbourhood of England in fuel poverty: living in a home with a poor energy efficiency rating and left below the poverty line after paying for energy.",
		summary:
			"The share of households in fuel poverty in each small neighbourhood of England. The fuel poverty map switches between the household rate and the number of affected households. Area summaries sum household counts and recompute the rate.",
	},
	crime: {
		title: "Crime",
		topic: "crime-and-justice",
		about: "Crimes recorded by the police in England and Wales, by type of offence. It's published for community safety partnerships, which mostly match councils, and the Atlas shows each partnership's figures on its local authorities. Recorded crime depends partly on how often crimes are reported, so it isn't a perfect measure of how much crime happens.",
		summary:
			"Police recorded crime in England and Wales for the year to March 2026, in total and for more than twenty types of offence, for each community safety partnership. Fraud isn't included.",
		publishedOn: "communitySafetyPartnership",
	},
	"general-election": {
		title: "General Election Results",
		topic: "general-elections",
		about: "Results of recent UK general elections for every Westminster constituency: votes for each party, the winner, turnout and majority.",
		summary:
			"Results for every Westminster constituency at the 2010, 2015, 2017, 2019 and 2024 general elections: votes for each party, vote shares, turnout and the winner.",
	},
	"historical-general-election": {
		title: "General Election Results, 1918-2019",
		topic: "general-elections",
		about: "General election results for every constituency back to 1918, grouped into broad party families so a century of results can be compared.",
	},
	"local-election": {
		title: "Local Election Results",
		topic: "local-elections",
		about: "Results of council elections in each ward of England and Wales: votes for each party, the winners and turnout where it's recorded.",
		summary:
			"Ward-level local election results for England and Wales from 2016 to 2025: votes by party, the winning party, and turnout from 2021 onwards.",
	},
	brexit: {
		title: "EU Referendum Results",
		topic: "referendums",
		about: "Official results of the 2016 referendum on the UK's membership of the European Union, for each counting area, which were mostly local authorities.",
	},
	"brexit-constituency": {
		title: "EU Referendum Results (Constituency Estimates)",
		topic: "referendums",
		about: "Estimates of how each Westminster constituency voted in the 2016 EU referendum. Votes were counted by local authority, so these figures are modelled by the political scientist Chris Hanretty rather than official.",
	},
	"air-quality": {
		title: "Air Quality",
		topic: "air-quality",
		about: "Modelled levels of the main air pollutants, nitrogen dioxide and fine particulate matter (PM2.5 and PM10), averaged over each local authority. These pollutants are linked to heart and lung disease.",
		summary:
			"Average background levels of nitrogen dioxide and particulate matter (PM10 and PM2.5) in each UK local authority, from Defra's modelled pollution maps.",
	},
	"ghg-emissions": {
		title: "Greenhouse Gas Emissions",
		topic: "emissions",
		about: "Estimated greenhouse gas emissions produced within each local authority. The map defaults to emissions per person so areas of different sizes can be compared. Select total emissions, emissions excluding land use or a sector such as transport, homes, industry or agriculture in the legend. Sector figures are totals in kilotonnes of carbon dioxide equivalent; land use can be negative where it removes more emissions than it produces.",
		summary:
			"Net greenhouse gas emissions produced within each UK local authority every year from 2005 to 2024, in kilotonnes of CO2 equivalent. The legend also maps transport, domestic, industrial, commercial, public-sector, agricultural, waste and land-use emissions separately in kt CO2e. Land use can be negative where removals exceed emissions; regional sector totals sum the authorities.",
	},
	"land-area": {
		title: "Land Area",
		topic: "emissions",
		about: "The official size of each local authority in hectares, measured by the Office for National Statistics. Land area is what population density is calculated from, so it excludes lakes, reservoirs and other inland water.",
	},
	"electricity-consumption": {
		title: "Subnational electricity consumption",
		topic: "energy",
		about: "How much electricity homes and businesses in each local authority in Great Britain use each year, from meter readings.",
		summary:
			"Metered electricity used in each Great Britain local authority from 2015 to 2024, split between domestic and non-domestic meters. These are meter readings rather than a model, so they add up over areas exactly. The map legend switches between all, domestic and non-domestic meters, in total GWh or GWh per 100,000 residents. Cards show the selected meter group in total GWh; regional figures sum consumption.",
	},
	"gas-consumption": {
		title: "Subnational gas consumption",
		topic: "energy",
		about: "How much mains gas homes and businesses in each local authority in Great Britain use each year, from meter readings, adjusted for the weather.",
		summary:
			"Metered gas used in each Great Britain local authority from 2015 to 2024, split between domestic and non-domestic meters. These are meter readings rather than a model, so they add up over areas exactly. The map legend switches between all, domestic and non-domestic meters, in total GWh or GWh per 100,000 residents. Cards show the selected meter group in total GWh; regional figures sum consumption.",
	},
	waste: {
		title: "Local authority collected waste management",
		topic: "waste",
		about: "How much household and other waste English councils collect, and how much of it is recycled, composted or sent to landfill.",
		summary:
			"Local-authority collected waste in England, including material sent for recycling, composting and reuse. The atlas legend switches between collected tonnes, recycled tonnes and the recycling percentage. Tonnage measures can also be shown per 100,000 residents. For authorities with data, regional recycling percentages divide summed recycled tonnes by summed collected tonnes.",
	},
	"travel-to-work": {
		title: "Travel to Work",
		topic: "commuting",
		related: ["labour-market"],
		about: "How people in work usually travel to their job, by car, public transport, bike or on foot, and how many worked mainly from home, from the 2021 Census.",
		summary:
			"How working residents of each local authority in England and Wales get to work, from driving and public transport to cycling and working from home, from Census 2021.",
	},
	"car-availability": {
		title: "Car Availability",
		topic: "vehicles",
		about: "How many cars or vans households have, from the 2021 Census. The Atlas maps the share of households with no car, which is highest in big cities with good public transport.",
		summary:
			"How many households in each local authority in England and Wales have no car, one, two, or three or more, from Census 2021.",
	},
	"electric-vehicle-chargers": {
		title: "Public electric vehicle chargers by local authority",
		topic: "vehicles",
		related: ["energy"],
		about: "How many public charging devices for electric vehicles there are in each local authority, counted every quarter by the Department for Transport.",
		summary:
			"Public electric vehicle charger counts by UK local authority.",
	},
	"road-collisions": {
		title: "Road Collisions by Local Authority",
		topic: "road-safety",
		about: "Road collisions in which someone was injured, as reported to the police, for each local authority in Great Britain, split by how serious the worst injury was.",
		summary:
			"Final annual counts of road collisions reported to the police in 2024 and 2025, by how serious the worst injury was, for local authorities in Great Britain and small areas in England and Wales.",
	},
	broadband: {
		title: "Broadband Coverage",
		topic: "digital-connectivity",
		about: "The share of homes and businesses in each local authority that can get each speed of fixed broadband, from superfast to full fibre gigabit, from Ofcom's annual Connected Nations report.",
		summary:
			"The share of premises in each UK local authority that can get superfast, ultrafast, full fibre and gigabit broadband, from Ofcom.",
	},
	"mobile-coverage": {
		title: "Mobile Coverage",
		topic: "digital-connectivity",
		about: "How much of each local authority gets 4G and 5G signal, from Ofcom's Connected Nations report, both at premises and across the landmass, from all mobile operators and from at least one.",
		summary:
			"The share of premises in each UK local authority covered by 4G and 5G from all four mobile networks, from Ofcom. The legend selects indoor 4G, outdoor 5G or landmass coverage, using any operator or all four where published. Premises measures use premises-weighted regional averages; landmass measures use an unweighted mean of authorities, not a combined landmass percentage.",
	},
};
