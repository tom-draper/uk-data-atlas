/**
 * Where each old dataset page now lives. The docs used to have one page per
 * hand-picked group of datasets, at /docs/v1/datasets/<slug>; they now have a
 * page per theme, topic and dataset. A group of one dataset goes to that
 * dataset's page, and a larger group to the topic page that holds it.
 *
 * Plain data with no imports, because next.config.ts reads it. A test checks
 * every destination is a page that exists.
 */
export const LEGACY_DATA_PAGES: Readonly<Record<string, string>> = {
	population: "/docs/v1/datasets/population/population-estimates",
	"census-2021-small-areas":
		"/docs/v1/datasets/population/population-estimates",
	ethnicity: "/docs/v1/datasets/population/ethnicity-and-identity/ethnicity",
	qualifications: "/docs/v1/datasets/education/qualifications/qualification",
	"life-expectancy":
		"/docs/v1/datasets/health/life-expectancy/life-expectancy-series",
	jobs: "/docs/v1/datasets/economy/labour-market/jobs",
	pay: "/docs/v1/datasets/economy/earnings-and-income",
	businesses: "/docs/v1/datasets/economy/business/business-activity",
	"local-government-finance": "/docs/v1/datasets/economy/public-finance",
	"economic-output": "/docs/v1/datasets/economy/economic-output",
	unemployment: "/docs/v1/datasets/economy/labour-market/unemployment",
	"claimant-count": "/docs/v1/datasets/economy/labour-market/claimant-count",
	"house-prices":
		"/docs/v1/datasets/housing/prices-and-affordability/house-price",
	"temporary-accommodation":
		"/docs/v1/datasets/housing/homelessness/homelessness",
	"housing-supply-and-planning": "/docs/v1/datasets/housing/housing-stock",
	"adult-social-care": "/docs/v1/datasets/health/social-care",
	deprivation: "/docs/v1/datasets/society/deprivation",
	"general-elections":
		"/docs/v1/datasets/politics/general-elections/general-election",
	"local-elections":
		"/docs/v1/datasets/politics/local-elections/local-election",
	"travel-to-work": "/docs/v1/datasets/transport/commuting/travel-to-work",
	"car-availability": "/docs/v1/datasets/transport/vehicles/car-availability",
	"road-collisions":
		"/docs/v1/datasets/transport/road-safety/road-collisions",
	"electric-vehicle-chargers":
		"/docs/v1/datasets/transport/vehicles/electric-vehicle-chargers",
	broadband:
		"/docs/v1/datasets/infrastructure/digital-connectivity/broadband",
	"mobile-coverage":
		"/docs/v1/datasets/infrastructure/digital-connectivity/mobile-coverage",
	"air-quality": "/docs/v1/datasets/environment/air-quality/air-quality",
	"greenhouse-gas-emissions":
		"/docs/v1/datasets/environment/emissions/ghg-emissions",
	"energy-consumption": "/docs/v1/datasets/environment/energy",
	waste: "/docs/v1/datasets/environment/waste/waste",
	crime: "/docs/v1/datasets/society/crime-and-justice/crime",
};
