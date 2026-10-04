/**
 * The /datasets page: each dataset's topic and a plain explanation of what it
 * measures. Sources, years, licences and boundaries come from the dataset
 * registry; the reference tests check every registered dataset has an entry.
 */

export interface DatasetTopic {
	id: string;
	title: string;
}

export interface DatasetGuide {
	topic: string;
	about: string;
}

export const DATASET_TOPICS: DatasetTopic[] = [
	{ id: "people-and-places", title: "People and places" },
	{ id: "health-and-care", title: "Health and care" },
	{ id: "education", title: "Education" },
	{ id: "work-and-economy", title: "Work and the economy" },
	{ id: "poverty-and-deprivation", title: "Poverty and deprivation" },
	{ id: "housing", title: "Housing" },
	{ id: "elections", title: "Elections" },
	{ id: "councils", title: "Councils" },
	{ id: "transport", title: "Transport" },
	{ id: "connectivity", title: "Connectivity" },
	{ id: "energy-and-environment", title: "Energy and environment" },
	{ id: "crime-and-safety", title: "Crime and safety" },
];

export const DATASET_GUIDES: Record<string, DatasetGuide> = {
	"population-uk": {
		topic: "people-and-places",
		about: "How many people live in each local authority across the UK, estimated every year by the Office for National Statistics between censuses. It's the standard yardstick for comparing places of different sizes, and many per-person figures in the Atlas are worked out from it.",
	},
	population: {
		topic: "people-and-places",
		about: "Population estimates for the much smaller electoral wards of England and Wales, broken down by age and sex. The Atlas uses it for its population density, age and gender maps, which show how people are spread within a council area rather than across the country.",
	},
	"population-constituency": {
		topic: "people-and-places",
		about: "How many people live in each Westminster constituency in England and Wales, on the boundaries used from the 2024 general election onwards. Useful for putting election results and other constituency figures in context.",
	},
	ethnicity: {
		topic: "people-and-places",
		about: "The ethnic groups residents identified with in the 2021 Census, for every local authority in England and Wales. It shows how the make-up of the population differs from place to place.",
	},
	qualification: {
		topic: "people-and-places",
		about: "The highest qualification held by residents aged 16 and over in the 2021 Census, from no qualifications up to degree level. The Atlas maps the share of residents with a degree or equivalent.",
	},
	"land-area": {
		topic: "people-and-places",
		about: "The official size of each local authority in hectares, measured by the Office for National Statistics. Land area is what population density is calculated from, so it excludes lakes, reservoirs and other inland water.",
	},
	"life-expectancy": {
		topic: "health-and-care",
		about: "How long a baby born today could expect to live, and how many of those years in good health, if current death rates held. Figures are averaged over three years for each local area, and are one of the clearest measures of health inequality between places.",
	},
	"life-expectancy-series": {
		topic: "health-and-care",
		about: "Life expectancy at birth for men and women in each local area, going back to the early 2000s. It shows how the gap between places has changed over two decades, with confidence intervals so small differences aren't over-read.",
	},
	"nhs-waiting": {
		topic: "health-and-care",
		about: "How long patients in England have been waiting for planned hospital treatment after a GP referral. Waits are reported for each integrated care board, the NHS body that plans services for an area.",
	},
	"adult-social-care-activity": {
		topic: "health-and-care",
		about: "How many adults receive long-term social care support from their council in England, such as care at home or in a care home, split between working-age adults and people aged 65 and over.",
	},
	"adult-social-care-outcomes": {
		topic: "health-and-care",
		about: "How people who use adult social care in England rate their quality of life, scored out of 24 from a national survey. It's one of the main ways the government compares how well council care services work.",
	},
	"school-performance": {
		topic: "education",
		about: "GCSE results for state-funded schools in England, grouped by local authority. It includes Attainment 8, the average grade across a pupil's best eight subjects, and Progress 8, how much progress pupils made compared with others who started secondary school at a similar level.",
	},
	"school-performance-constituency": {
		topic: "education",
		about: "The same GCSE measures as the local authority figures, grouped instead by Westminster constituency, so results can be compared with each MP's area.",
	},
	"school-performance-gap": {
		topic: "education",
		about: "How far disadvantaged pupils in each English local authority trail their classmates at GCSE. Disadvantaged pupils are those eligible for free school meals in recent years or who have been in care.",
	},
	"business-activity": {
		topic: "work-and-economy",
		about: "How many businesses are based in each local authority, counting those registered for VAT or running a PAYE payroll. It gives a sense of the size and spread of local economies.",
	},
	jobs: {
		topic: "work-and-economy",
		about: "How many jobs are based in each local authority, counted where people work rather than where they live. Places with large city centres or business parks can have more jobs than residents.",
	},
	income: {
		topic: "work-and-economy",
		about: "Typical annual pay for employees who live in each local authority in England, from the Annual Survey of Hours and Earnings. The Atlas uses the median, the middle value, so a few very high earners don't skew it.",
	},
	"workplace-income": {
		topic: "work-and-economy",
		about: "Typical annual pay for jobs based in each local authority in England, whoever does them. Comparing it with pay by where people live shows which places people commute into for better-paid work.",
	},
	"claimant-count": {
		topic: "work-and-economy",
		about: "The share of working-age residents claiming unemployment-related benefits, Universal Credit or Jobseeker's Allowance, in each local authority. It's published monthly, so it's the most up-to-date local view of unemployment.",
	},
	unemployment: {
		topic: "work-and-economy",
		about: "Estimates of the share of economically active people who are out of work and looking for a job, modelled for each local authority from survey data. The series ended in 2022.",
	},
	"regional-gdp-itl1": {
		topic: "work-and-economy",
		about: "The size of the economy in each English region and the three other nations, measured as gross domestic product and gross value added. These figures underpin comparisons of regional prosperity.",
	},
	"regional-gdp-itl2": {
		topic: "work-and-economy",
		about: "Gross domestic product and gross value added for the middle tier of UK statistical regions, which are mostly counties or groups of counties and city regions.",
	},
	"regional-gdp-itl3": {
		topic: "work-and-economy",
		about: "Gross domestic product and gross value added for the most detailed UK statistical regions, mostly individual or paired local authorities. It's the finest level at which official GDP is published.",
	},
	imd: {
		topic: "poverty-and-deprivation",
		about: "The English Indices of Deprivation rank every small neighbourhood in England from most to least deprived, combining income, employment, education, health, crime, housing and living environment. It's the standard way to find the most deprived areas in England.",
	},
	wimd: {
		topic: "poverty-and-deprivation",
		about: "Wales's own index of deprivation, ranking every small neighbourhood in Wales across income, employment, health, education, access to services, housing, community safety and environment. Its ranks can't be compared directly with England's.",
	},
	simd: {
		topic: "poverty-and-deprivation",
		about: "Scotland's index of deprivation, ranking each of its small areas, called data zones, from most to least deprived. It's widely used to target funding and services in Scotland.",
	},
	nimdm: {
		topic: "poverty-and-deprivation",
		about: "Northern Ireland's measure of deprivation, ranking each of its small areas from most to least deprived across income, employment, health, education, access to services, living environment and crime.",
	},
	"child-poverty": {
		topic: "poverty-and-deprivation",
		about: "The share of children under 16 in each local authority living in families on relatively low incomes, below 60% of the UK median, before housing costs. It's the government's main local measure of child poverty.",
	},
	"fuel-poverty": {
		topic: "poverty-and-deprivation",
		about: "The share of households in each small neighbourhood of England in fuel poverty: living in a home with a poor energy efficiency rating and left below the poverty line after paying for energy.",
	},
	"house-price": {
		topic: "housing",
		about: "The prices homes sold for in each ward of England and Wales, based on Land Registry sales records, going back to 1995. The Atlas shows the median price, the price in the middle of all sales.",
	},
	"housing-affordability": {
		topic: "housing",
		about: "How many years of typical local earnings it would take to buy a typical home in each local authority. A ratio of 10 means the median home costs ten times the median full-time salary of residents.",
	},
	homelessness: {
		topic: "housing",
		about: "How many households in each English council area are living in temporary accommodation, such as hostels or bed and breakfasts, while they wait for a settled home. Rates are shown per 1,000 households.",
	},
	"net-additional-dwellings": {
		topic: "housing",
		about: "How much the number of homes in each English local authority grew over the year, counting new builds and conversions, minus demolitions. It's the government's main measure of housing supply.",
	},
	"planning-applications": {
		topic: "housing",
		about: "How many planning applications each local planning authority in England received in a quarter, from house extensions to major developments.",
	},
	"general-election": {
		topic: "elections",
		about: "Results of recent UK general elections for every Westminster constituency: votes for each party, the winner, turnout and majority.",
	},
	"historical-general-election": {
		topic: "elections",
		about: "General election results for every constituency back to 1918, grouped into broad party families so a century of results can be compared.",
	},
	"local-election": {
		topic: "elections",
		about: "Results of council elections in each ward of England and Wales: votes for each party, the winners and turnout where it's recorded.",
	},
	brexit: {
		topic: "elections",
		about: "Official results of the 2016 referendum on the UK's membership of the European Union, for each counting area, which were mostly local authorities.",
	},
	"brexit-constituency": {
		topic: "elections",
		about: "Estimates of how each Westminster constituency voted in the 2016 EU referendum. Votes were counted by local authority, so these figures are modelled by the political scientist Chris Hanretty rather than official.",
	},
	"council-tax": {
		topic: "councils",
		about: "The average Band D council tax bill in each English council area, including precepts for police, fire and parish councils. Band D is the standard band used to compare council tax between areas.",
	},
	"local-government-finance": {
		topic: "councils",
		about: "What English councils plan to spend on their services this financial year, from their budget returns to government. The Atlas maps spending on education services.",
	},
	waste: {
		topic: "councils",
		about: "How much household and other waste English councils collect, and how much of it is recycled, composted or sent to landfill.",
	},
	"car-availability": {
		topic: "transport",
		about: "How many cars or vans households have, from the 2021 Census. The Atlas maps the share of households with no car, which is highest in big cities with good public transport.",
	},
	"travel-to-work": {
		topic: "transport",
		about: "How people in work usually travel to their job, by car, public transport, bike or on foot, and how many worked mainly from home, from the 2021 Census.",
	},
	"electric-vehicle-chargers": {
		topic: "transport",
		about: "How many public charging devices for electric vehicles there are in each local authority, counted every quarter by the Department for Transport.",
	},
	broadband: {
		topic: "connectivity",
		about: "The share of homes and businesses in each local authority that can get each speed of fixed broadband, from superfast to full fibre gigabit, from Ofcom's annual Connected Nations report.",
	},
	"mobile-coverage": {
		topic: "connectivity",
		about: "How much of each local authority gets 4G and 5G signal, from Ofcom's Connected Nations report, both at premises and across the landmass, from all mobile operators and from at least one.",
	},
	"ghg-emissions": {
		topic: "energy-and-environment",
		about: "Estimated greenhouse gas emissions produced within each local authority, broken down by sector, such as transport, homes, industry and agriculture. The Atlas shows emissions per person so areas of different sizes can be compared.",
	},
	"air-quality": {
		topic: "energy-and-environment",
		about: "Modelled levels of the main air pollutants, nitrogen dioxide and fine particulate matter (PM2.5 and PM10), averaged over each local authority. These pollutants are linked to heart and lung disease.",
	},
	"electricity-consumption": {
		topic: "energy-and-environment",
		about: "How much electricity homes and businesses in each local authority in Great Britain use each year, from meter readings.",
	},
	"gas-consumption": {
		topic: "energy-and-environment",
		about: "How much mains gas homes and businesses in each local authority in Great Britain use each year, from meter readings, adjusted for the weather.",
	},
	crime: {
		topic: "crime-and-safety",
		about: "Crimes recorded by the police in each local authority of England and Wales, by type of offence. Recorded crime depends partly on how often crimes are reported, so it isn't a perfect measure of how much crime happens.",
	},
	"road-collisions": {
		topic: "crime-and-safety",
		about: "Road collisions in which someone was injured, as reported to the police, for each local authority in Great Britain, split by how serious the worst injury was.",
	},
};
