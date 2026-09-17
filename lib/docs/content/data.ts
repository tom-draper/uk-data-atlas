/**
 * The data pages: each gathers the datasets people think of as one subject
 * and introduces them in plain words. Facts on the page (years, nations,
 * areas, measures) are generated from the catalogue; the docs tests check
 * every served dataset appears on exactly one page.
 */

export interface DataTopic {
	id: string;
	title: string;
}

export interface DataPage {
	slug: string;
	title: string;
	topic: string;
	datasets: string[];
	/** What the data is and why you'd use it, for readers and search. */
	intro: string;
}

export const DATA_TOPICS: DataTopic[] = [
	{ id: "people", title: "People" },
	{ id: "work", title: "Work and money" },
	{ id: "housing", title: "Housing and deprivation" },
	{ id: "elections", title: "Elections" },
	{ id: "transport", title: "Transport" },
	{ id: "connectivity", title: "Connectivity" },
	{ id: "environment", title: "Environment" },
	{ id: "crime", title: "Crime" },
];

export const DATA_PAGES: DataPage[] = [
	{
		slug: "population",
		title: "Population",
		topic: "people",
		datasets: ["population-uk", "population", "population-constituency"],
		intro: "Official population estimates from the Office for National Statistics: every UK local authority each year since 2011, wards in England and Wales, and the Westminster constituencies first contested in 2024. Population density is included too.",
	},
	{
		slug: "ethnicity",
		title: "Ethnicity",
		topic: "people",
		datasets: ["ethnicity"],
		intro: "How many residents of each local authority in England and Wales belong to each of the nineteen ethnic groups recorded in Census 2021.",
	},
	{
		slug: "qualifications",
		title: "Qualifications",
		topic: "people",
		datasets: ["qualification"],
		intro: "The highest qualification held by residents aged 16 and over in each local authority in England and Wales, from Census 2021.",
	},
	{
		slug: "life-expectancy",
		title: "Life expectancy",
		topic: "people",
		datasets: ["life-expectancy-series"],
		intro: "Life expectancy at birth for men and women in local areas of England, Wales and Northern Ireland, for every three-year period since 2001 to 2003, with confidence intervals.",
	},
	{
		slug: "jobs",
		title: "Jobs",
		topic: "work",
		datasets: ["jobs"],
		intro: "The total number of jobs in each local authority from 2011 to 2024, counted where people work rather than where they live.",
	},
	{
		slug: "pay",
		title: "Pay",
		topic: "work",
		datasets: ["income"],
		intro: "Median annual and hourly pay for employees in each English local authority, by where they live.",
	},
	{
		slug: "economic-output",
		title: "Economic output",
		topic: "work",
		datasets: [
			"regional-gdp-itl1",
			"regional-gdp-itl2",
			"regional-gdp-itl3",
		],
		intro: "Gross domestic product and gross value added for every UK region, from 1998 to 2023, on all three tiers of the International Territorial Level geography that economic statistics are published on. Output is counted where it is produced, not where the people who earn it live.",
	},
	{
		slug: "unemployment",
		title: "Unemployment",
		topic: "work",
		datasets: ["unemployment"],
		intro: "The ONS's model-based estimates of unemployment for local authorities in Great Britain, from 1996 to 2021, as a rate and a count, with confidence intervals.",
	},
	{
		slug: "claimant-count",
		title: "Claimant count",
		topic: "work",
		datasets: ["claimant-count"],
		intro: "How many people in each local authority count as claimants of Universal Credit or Jobseeker's Allowance, in total and for 16 to 24 year olds.",
	},
	{
		slug: "house-prices",
		title: "House prices",
		topic: "housing",
		datasets: ["house-price"],
		intro: "The median price paid for homes in every ward in England and Wales, for each year from 1995 to 2022.",
	},
	{
		slug: "temporary-accommodation",
		title: "Temporary accommodation",
		topic: "housing",
		datasets: ["homelessness"],
		intro: "Households living in temporary accommodation in each English local authority, including households with children and the number of children.",
	},
	{
		slug: "deprivation",
		title: "Deprivation",
		topic: "housing",
		datasets: ["imd", "wimd", "simd", "nimdm"],
		intro: "The official indices of deprivation for all four UK nations, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	{
		slug: "general-elections",
		title: "General elections",
		topic: "elections",
		datasets: ["general-election"],
		intro: "Results for every Westminster constituency at the 2010, 2015, 2017, 2019 and 2024 general elections: votes for each party, vote shares, turnout and the winner.",
	},
	{
		slug: "local-elections",
		title: "Local elections",
		topic: "elections",
		datasets: ["local-election"],
		intro: "Ward-level local election results for England and Wales from 2016 to 2025: votes by party, the winning party, and turnout from 2021 onwards.",
	},
	{
		slug: "travel-to-work",
		title: "Travel to work",
		topic: "transport",
		datasets: ["travel-to-work"],
		intro: "How working residents of each local authority in England and Wales get to work, from driving and public transport to cycling and working from home, from Census 2021.",
	},
	{
		slug: "car-availability",
		title: "Car availability",
		topic: "transport",
		datasets: ["car-availability"],
		intro: "How many households in each local authority in England and Wales have no car, one, two, or three or more, from Census 2021.",
	},
	{
		slug: "road-collisions",
		title: "Road collisions",
		topic: "transport",
		datasets: ["road-collisions"],
		intro: "Provisional counts of reported road collisions in the first half of 2025, by how serious the worst injury was, for local authorities in Great Britain and small areas in England and Wales.",
	},
	{
		slug: "broadband",
		title: "Broadband",
		topic: "connectivity",
		datasets: ["broadband"],
		intro: "The share of premises in each UK local authority that can get superfast, ultrafast, full fibre and gigabit broadband, from Ofcom.",
	},
	{
		slug: "mobile-coverage",
		title: "Mobile coverage",
		topic: "connectivity",
		datasets: ["mobile-coverage"],
		intro: "The share of premises in each UK local authority covered by 4G and 5G from all four mobile networks, from Ofcom.",
	},
	{
		slug: "air-quality",
		title: "Air quality",
		topic: "environment",
		datasets: ["air-quality"],
		intro: "Average background levels of nitrogen dioxide and particulate matter (PM10 and PM2.5) in each UK local authority, from Defra's modelled pollution maps.",
	},
	{
		slug: "greenhouse-gas-emissions",
		title: "Greenhouse gas emissions",
		topic: "environment",
		datasets: ["ghg-emissions"],
		intro: "Net greenhouse gas emissions produced within each UK local authority every year from 2005 to 2024, in kilotonnes of CO2 equivalent.",
	},
	{
		slug: "crime",
		title: "Crime",
		topic: "crime",
		datasets: ["crime"],
		intro: "Police recorded crime in England and Wales for the year to March 2026, in total and for more than twenty types of offence, for each community safety partnership. Fraud isn't included.",
	},
];
