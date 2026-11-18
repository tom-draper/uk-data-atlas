export const PUBLIC_HEALTH_MEASURES = [
	{
		value: "smoking",
		label: "Adult smoking (18+)",
		id: "92443",
		age: "18+ yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "adultExcessWeight",
		label: "Adult overweight including obesity (18+)",
		id: "93088",
		age: "18+ yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "activity",
		label: "Physically active adults (19+)",
		id: "93014",
		age: "19+ yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "receptionExcessWeight",
		label: "Reception overweight including obesity (4-5)",
		id: "20601",
		age: "4-5 yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "year6ExcessWeight",
		label: "Year 6 overweight including obesity (10-11)",
		id: "20602",
		age: "10-11 yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "preventableMortality",
		label: "Preventable mortality under 75",
		id: "93721",
		age: "<75 yrs",
		unit: "per 100,000",
		maximum: 400,
	},
] as const;
export type PublicHealthMeasure =
	(typeof PUBLIC_HEALTH_MEASURES)[number]["value"];
export interface PublicHealthRecord {
	code: string;
	name: string;
	metrics: Partial<Record<PublicHealthMeasure, number>>;
	isAverage?: boolean;
}
export interface PublicHealthDataset {
	id: string;
	type: "public-health";
	year: number;
	boundaryType: "countyAndUnitaryAuthority";
	boundaryYear: number;
	data: Record<string, PublicHealthRecord>;
	periods: Partial<Record<PublicHealthMeasure, string>>;
}
