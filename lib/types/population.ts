// lib/types/population.ts
import { WardYear } from "../data/boundaries/boundaries";
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

export interface AggregatedPopulationData {
	2020: {
		populationStats: PopulationStats;
		ageData: AgeData;
		ages: Array<{ age: number; count: number }>;
		genderAgeData: Array<{ age: number; males: number; females: number }>;
		medianAge: number;
		totalArea: number;
		density: number;
	};
}
