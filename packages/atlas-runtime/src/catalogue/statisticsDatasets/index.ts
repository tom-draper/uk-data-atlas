import type { DeclaredDataset } from "../declaredStatistics";
import {
	CAR_AVAILABILITY,
	ETHNICITY,
	GENERAL_HEALTH,
	HOUSING_TENURE,
	QUALIFICATION,
	TRAVEL_TO_WORK,
} from "./census";
import {
	BUSINESS_ACTIVITY,
	CHILD_POVERTY,
	CLAIMANT_COUNT,
	COUNCIL_TAX,
	HOUSE_PRICE,
	HOUSING_AFFORDABILITY,
	INCOME,
	JOBS,
	LOCAL_GOVERNMENT_FINANCE,
	REGIONAL_GDP_ITL1,
	REGIONAL_GDP_ITL2,
	REGIONAL_GDP_ITL3,
	UNEMPLOYMENT,
	WORKPLACE_INCOME,
} from "./economy";
import {
	AIR_QUALITY,
	BROADBAND,
	ELECTRIC_VEHICLE_CHARGERS,
	ELECTRICITY_CONSUMPTION,
	GAS_CONSUMPTION,
	GHG_EMISSIONS,
	LAND_AREA,
	MOBILE_COVERAGE,
	WASTE,
} from "./environment";
import {
	ADULT_SOCIAL_CARE_ACTIVITY,
	ADULT_SOCIAL_CARE_OUTCOMES,
	CRIME,
	HOMELESSNESS,
	NET_ADDITIONAL_DWELLINGS,
	PLANNING_APPLICATIONS,
	PUBLIC_HEALTH,
	PUPIL_ABSENCE,
	ROAD_COLLISIONS,
	SCHOOL_PERFORMANCE,
	SCHOOL_PERFORMANCE_CONSTITUENCY,
	SCHOOL_PERFORMANCE_DISADVANTAGE,
} from "./services";

/** Catalogue datasets stored as statistics rows, by manifest type. */
export const STATISTICS_DATASETS: readonly DeclaredDataset[] = [
	CAR_AVAILABILITY,
	QUALIFICATION,
	TRAVEL_TO_WORK,
	ETHNICITY,
	GENERAL_HEALTH,
	HOUSING_TENURE,
	INCOME,
	WORKPLACE_INCOME,
	JOBS,
	BUSINESS_ACTIVITY,
	CLAIMANT_COUNT,
	UNEMPLOYMENT,
	CHILD_POVERTY,
	REGIONAL_GDP_ITL1,
	REGIONAL_GDP_ITL2,
	REGIONAL_GDP_ITL3,
	COUNCIL_TAX,
	LOCAL_GOVERNMENT_FINANCE,
	HOUSING_AFFORDABILITY,
	HOUSE_PRICE,
	AIR_QUALITY,
	GHG_EMISSIONS,
	ELECTRICITY_CONSUMPTION,
	GAS_CONSUMPTION,
	ELECTRIC_VEHICLE_CHARGERS,
	WASTE,
	LAND_AREA,
	BROADBAND,
	MOBILE_COVERAGE,
	CRIME,
	ROAD_COLLISIONS,
	HOMELESSNESS,
	ADULT_SOCIAL_CARE_ACTIVITY,
	ADULT_SOCIAL_CARE_OUTCOMES,
	NET_ADDITIONAL_DWELLINGS,
	PLANNING_APPLICATIONS,
	PUBLIC_HEALTH,
	PUPIL_ABSENCE,
	SCHOOL_PERFORMANCE,
	SCHOOL_PERFORMANCE_CONSTITUENCY,
	SCHOOL_PERFORMANCE_DISADVANTAGE,
];

/**
 * Manifest types not yet stored as statistics rows, and why. The build
 * refuses a type that is in neither list.
 */
export const UNSTORED_DATASETS: Readonly<Record<string, string>> = {
	generalElection:
		"Candidates, parties and winners need the election tables before they become observations.",
	localElection:
		"Ward results need the election tables, and several years use county division codes outside the ward releases.",
	historicalGeneralElection:
		"Results before 2010 are on constituency boundaries the atlas has no release for.",
	nhsWaiting:
		"Integrated care boards are keyed by NHS organisation codes, not the GSS codes of the area tables.",
};
