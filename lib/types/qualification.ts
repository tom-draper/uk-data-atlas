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

export const QUALIFICATION_LEVELS = [
	{ key: "level4Plus", label: "Level 4+" },
	{ key: "level3", label: "Level 3" },
	{ key: "apprenticeship", label: "Apprenticeship" },
	{ key: "level2", label: "Level 2" },
	{ key: "level1", label: "Level 1" },
	{ key: "noQualifications", label: "No qualifications" },
	{ key: "other", label: "Other" },
] as const;

export type QualificationKey = (typeof QUALIFICATION_LEVELS)[number]["key"];

export const QUALIFICATION_COLORS: Record<QualificationKey, string> = {
	noQualifications: "#ef4444",
	level1: "#f97316",
	level2: "#eab308",
	apprenticeship: "#84cc16",
	level3: "#22c55e",
	level4Plus: "#3b82f6",
	other: "#9ca3af",
};
