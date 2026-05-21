export interface LifeExpectancyLADData {
	ladCode: string;
	ladName: string;
	maleBirthLE: number;
	femaleBirthLE: number;
}

export interface LifeExpectancyDataset {
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
