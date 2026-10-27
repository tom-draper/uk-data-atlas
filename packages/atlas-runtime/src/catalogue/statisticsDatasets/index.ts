import type { DeclaredDataset } from "../declaredStatistics";
import {
	CAR_AVAILABILITY,
	ETHNICITY,
	GENERAL_HEALTH,
	HOUSING_TENURE,
	QUALIFICATION,
	TRAVEL_TO_WORK,
} from "./census";

/** Catalogue datasets stored as statistics rows, by manifest type. */
export const STATISTICS_DATASETS: readonly DeclaredDataset[] = [
	CAR_AVAILABILITY,
	QUALIFICATION,
	TRAVEL_TO_WORK,
	ETHNICITY,
	GENERAL_HEALTH,
	HOUSING_TENURE,
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
