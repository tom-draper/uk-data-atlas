/**
 * The topics the database is divided into, so it can be sold or packaged by
 * topic. Every dataset declares exactly one. The list is closed: adding a
 * module is a product decision, made here and in `docs/dataset-declarations.md`.
 */
export const DATASET_MODULES = [
	"core",
	"economy",
	"education",
	"health",
	"housing",
	"crime",
	"politics",
	"environment",
	"infrastructure",
	"population",
	"deprivation",
	"transport",
] as const;

export type DatasetModule = (typeof DATASET_MODULES)[number];

/** What each module holds. */
export const DATASET_MODULE_SCOPE: Readonly<Record<DatasetModule, string>> = {
	core: "Geography: areas, releases, crosswalks, places and postcodes. No dataset declares it.",
	economy:
		"Pay, jobs, output, businesses, the labour market and public finance.",
	education: "Schools, attainment, absence and qualifications.",
	health: "Health, social care, life expectancy and waiting times.",
	housing: "House prices, tenure, homelessness, planning and new homes.",
	crime: "Recorded crime.",
	politics: "Elections and referendums.",
	environment: "Air quality, emissions, energy use, waste and land.",
	infrastructure: "Broadband and mobile coverage.",
	population: "Population counts and ethnicity.",
	deprivation: "Indices of deprivation, child poverty and fuel poverty.",
	transport: "Travel to work, car availability, collisions and charging.",
};

export const isDatasetModule = (value: unknown): value is DatasetModule =>
	typeof value === "string" &&
	(DATASET_MODULES as readonly string[]).includes(value);
