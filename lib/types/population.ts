// lib/types/population.ts
import { LocalAuthorityYear, WardYear } from "../data/boundaries/boundaries";
import { AgeData } from "./common";

export interface PopulationWardData {
	total: AgeData;
	males: AgeData;
	females: AgeData;
	wardName: string;
	ladCode: string;
	ladName: string;
}

export interface PopulationDataset {
	id: string;
	type: "population";
	year: number;
	boundaryYear: WardYear;
	boundaryType: "ward";
	data: Record<string, PopulationWardData>;
}

/**
 * A local authority's estimates for one mid-year. The ward equivalent carries
 * its parent LAD, so the analogous parent here is the country the authority
 * sits in ("E", "N", "S", "W").
 */
export interface PopulationLocalAuthorityData {
	total: AgeData;
	males: AgeData;
	females: AgeData;
	ladName: string;
	country: string;
}

/**
 * UK-wide local authority estimates. Separate from the ward dataset rather
 * than a boundary variant of it, because it comes from a different ONS release
 * with its own reference years.
 */
export interface PopulationUkDataset {
	id: string;
	type: "populationUk";
	year: number;
	boundaryYear: LocalAuthorityYear;
	boundaryType: "localAuthority";
	data: Record<string, PopulationLocalAuthorityData>;
}

export interface AgeGroups {
	"0-17": number;
	"18-29": number;
	"30-44": number;
	"45-64": number;
	"65+": number;
}

export interface PopulationStats {
	total: number;
	males: number;
	females: number;
	ageGroups: {
		total: AgeGroups;
		males: AgeGroups;
		females: AgeGroups;
	};
	isWardSpecific: boolean;
}

export interface PopulationYearlyData {
	populationStats: PopulationStats;
	ageData: AgeData;
	ages: Array<{ age: number; count: number }>;
	genderAgeData: Array<{ age: number; males: number; females: number }>;
	medianAge: number;
	totalArea: number;
	density: number;
}

export type AggregatedPopulationData = PopulationYearlyData;
