import type { BoundaryType } from "./catalog";

/**
 * How a boundary family is reduced to a named location. These are behaviours,
 * rather than boundary names, so adding a family does not require another
 * type-switch at each consumer.
 */
export type BoundaryLocationScope =
	| { kind: "none" }
	| { kind: "direct-membership" }
	| { kind: "parent-map"; mapping: "wardToLad" }
	| { kind: "crosswalk"; crosswalk: "constituencyLad" }
	| { kind: "bbox" };

export type BoundaryCapability = {
	/** Whether GSS country-code prefixes can provide a fast country filter. */
	countryPrefixFilter: boolean;
	locationScope: BoundaryLocationScope;
	/** Whether map geometry should be intersected with data record keys. */
	filterGeometryToDatasetData?: boolean;
};

const COUNTRY_PREFIX_ONLY = {
	countryPrefixFilter: true,
	locationScope: { kind: "none" },
} as const satisfies BoundaryCapability;

/**
 * Behavioural characteristics of each boundary family.
 *
 * Release files, properties and aliases remain in `catalog.ts`; keeping this
 * companion registry separate lets location filtering and map rendering share
 * the few capabilities they need without coupling to release details.
 */
export const BOUNDARY_CAPABILITIES = {
	ward: {
		countryPrefixFilter: true,
		locationScope: { kind: "parent-map", mapping: "wardToLad" },
	},
	constituency: {
		countryPrefixFilter: true,
		locationScope: { kind: "crosswalk", crosswalk: "constituencyLad" },
	},
	localAuthority: {
		countryPrefixFilter: true,
		locationScope: { kind: "direct-membership" },
	},
	lsoa: {
		countryPrefixFilter: true,
		locationScope: { kind: "bbox" },
		filterGeometryToDatasetData: true,
	},
	dataZone: {
		countryPrefixFilter: true,
		locationScope: { kind: "bbox" },
		filterGeometryToDatasetData: true,
	},
	superOutputArea: {
		// NI SOA codes (for example, "95AA01S1") do not have an N prefix.
		countryPrefixFilter: false,
		locationScope: { kind: "bbox" },
		filterGeometryToDatasetData: true,
	},
	country: COUNTRY_PREFIX_ONLY,
	localPlanningAuthority: COUNTRY_PREFIX_ONLY,
	region: COUNTRY_PREFIX_ONLY,
	countyAndUnitaryAuthority: COUNTRY_PREFIX_ONLY,
	integratedCareBoard: COUNTRY_PREFIX_ONLY,
	msoa: COUNTRY_PREFIX_ONLY,
	communitySafetyPartnership: COUNTRY_PREFIX_ONLY,
	policeForceArea: COUNTRY_PREFIX_ONLY,
	combinedAuthority: COUNTRY_PREFIX_ONLY,
	itl1: COUNTRY_PREFIX_ONLY,
	itl2: COUNTRY_PREFIX_ONLY,
	itl3: COUNTRY_PREFIX_ONLY,
	majorTownAndCity: COUNTRY_PREFIX_ONLY,
	scottishParliamentaryConstituency: COUNTRY_PREFIX_ONLY,
	scottishParliamentaryRegion: COUNTRY_PREFIX_ONLY,
	seneddConstituency: COUNTRY_PREFIX_ONLY,
	seneddElectoralRegion: COUNTRY_PREFIX_ONLY,
	localHealthBoard: COUNTRY_PREFIX_ONLY,
	nhsEnglandRegion: COUNTRY_PREFIX_ONLY,
	subIntegratedCareBoardLocation: COUNTRY_PREFIX_ONLY,
	fireAndRescueAuthority: COUNTRY_PREFIX_ONLY,
	nationalPark: COUNTRY_PREFIX_ONLY,
	countyElectoralDivision: COUNTRY_PREFIX_ONLY,
	travelToWorkArea: COUNTRY_PREFIX_ONLY,
	parish: COUNTRY_PREFIX_ONLY,
} as const satisfies Record<BoundaryType, BoundaryCapability>;

export const boundaryCapabilityFor = (type: BoundaryType): BoundaryCapability =>
	BOUNDARY_CAPABILITIES[type];
