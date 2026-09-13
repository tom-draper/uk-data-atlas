import type { DatasetCoverage } from "./coverage";

export interface LifeExpectancyLADData {
	ladCode: string;
	ladName: string;
	maleBirthLE: number;
	femaleBirthLE: number;
	/**
	 * Set on an authority the publisher does not report, whose values the loader
	 * built from these predecessors' estimates. Such a value is not a published
	 * life expectancy.
	 */
	derivedFromPredecessors?: string[];
}

export interface LifeExpectancyDataset extends DatasetCoverage {
	id: string;
	year: number;
	type: "lifeExpectancy";
	boundaryType: "localAuthority";
	boundaryYear: number;
	dataPeriod: string;
	label: string;
	data: Record<string, LifeExpectancyLADData>;
	metadata: {
		source: string;
		notes: string[];
	};
}

export interface AggregatedLifeExpectancyData {
	averageMaleLE: number;
	averageFemaleLE: number;
}
