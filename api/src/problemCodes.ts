/**
 * Every stable `code` a problem response can carry. A client branches on
 * `code` rather than on prose, so each one is declared here with the statuses
 * it comes with, the extension members it always carries, the alternatives it
 * may offer, and a request that produces it against the compiled catalogues.
 * The OpenAPI document gives each a schema, and a contract test sends each
 * example and checks the response against this entry.
 */
export type ProblemCodeDefinition = {
	statuses: readonly number[];
	/** Extension members present on every problem with this code. */
	members: readonly string[];
	/** Extension members that point the caller to what it can ask instead. */
	alternatives: readonly string[];
	meaning: string;
	example: string;
};

export const PROBLEM_CODES = {
	unsupported_geography: {
		statuses: [404],
		members: ["absence"],
		alternatives: ["links", "availableReleases"],
		meaning:
			"The geography or boundary release is not published, or its area identities are not compiled.",
		example: "/v1/areas/nowhere/2024-12-uk-bgc/E05000932",
	},
	area_not_in_release: {
		statuses: [404],
		members: ["absence", "presentIn"],
		alternatives: ["presentIn"],
		meaning:
			"The release is published and compiled but does not hold the code; `presentIn` lists releases that do.",
		example: "/v1/areas/ward/2016-12-gb-bgc/E05013830",
	},
	aggregation_not_supported: {
		statuses: [422],
		members: [],
		alternatives: [],
		meaning:
			"The measure's values do not add over areas, or its weights cannot be used.",
		example:
			"/v1/data/house-price-median/aggregate?period=2022&geography=ward&boundaryYear=2020&areaCode=E92000001",
	},
	conversion_not_available: {
		statuses: [422],
		members: [],
		alternatives: [],
		meaning:
			"The named crosswalk or source release cannot carry the partition without dropping, splitting or assuming values.",
		example:
			"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023&crosswalk=constituency-2010-to-2024-official-lookup-v2",
	},
	partial_coverage: {
		statuses: [422],
		members: [],
		alternatives: [],
		meaning:
			"A named location or a weight partition leaves out areas the sum would need, so no partial sum is served.",
		example:
			"/v1/data/population-estimate/aggregate?period=2024&geography=localAuthority&boundaryYear=2023&locationId=carlisle",
	},
	no_release_for_date: {
		statuses: [404],
		members: ["absence"],
		alternatives: ["earliest", "undated"],
		meaning:
			"No release of the geography was in force on the date; `earliest` names the first there is.",
		example: "/v1/boundary-releases:resolve?geography=ward&date=1990-01-01",
	},
	ambiguous_release: {
		statuses: [409],
		members: ["choices"],
		alternatives: ["choices"],
		meaning:
			"More than one release of the geography is dated that month and they differ in more than coverage; `choices` lists them.",
		example:
			"/v1/boundary-releases:resolve?geography=dataZone&date=2011-12-15",
	},
} as const satisfies Record<string, ProblemCodeDefinition>;

export type ProblemCode = keyof typeof PROBLEM_CODES;
