export interface QualificationBreakdown {
	noQualifications: number;
	level1: number;
	level2: number;
	apprenticeship: number;
	level3: number;
	level4Plus: number;
	other: number;
	total: number;
}

export interface QualificationLAData {
	ladCode: string;
	breakdown: QualificationBreakdown;
}

export interface QualificationDataset {
	id: string;
	type: "qualification";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, QualificationLAData>;
	metadata: { source: string; notes: string[] };
}

export interface AggregatedQualificationData {
	breakdown: QualificationBreakdown;
}
