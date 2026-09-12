export interface TravelToWorkBreakdown {
	workFromHome: number;
	/** Underground, metro, light rail and tram, train, and bus. */
	publicTransport: number;
	/** Driving and being driven; the census counts the two separately. */
	car: number;
	taxi: number;
	motorcycle: number;
	bicycle: number;
	onFoot: number;
	other: number;
	/** People in employment, which is the denominator for every share. */
	total: number;
}

export interface TravelToWorkLAData {
	ladCode: string;
	breakdown: TravelToWorkBreakdown;
}

export interface TravelToWorkDataset {
	id: string;
	type: "travelToWork";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, TravelToWorkLAData>;
	metadata: { source: string; notes: string[] };
}

export interface AggregatedTravelToWorkData {
	breakdown: TravelToWorkBreakdown;
}

export const TRAVEL_TO_WORK_MODES = [
	{ key: "car", label: "Car or van" },
	{ key: "workFromHome", label: "Work from home" },
	{ key: "publicTransport", label: "Public transport" },
	{ key: "onFoot", label: "On foot" },
	{ key: "bicycle", label: "Bicycle" },
	{ key: "taxi", label: "Taxi" },
	{ key: "motorcycle", label: "Motorcycle" },
	{ key: "other", label: "Other" },
] as const;

export type TravelToWorkMode = (typeof TRAVEL_TO_WORK_MODES)[number]["key"];

export const TRAVEL_TO_WORK_COLORS: Record<TravelToWorkMode, string> = {
	car: "#ef4444",
	workFromHome: "#3b82f6",
	publicTransport: "#8b5cf6",
	onFoot: "#22c55e",
	bicycle: "#84cc16",
	taxi: "#eab308",
	motorcycle: "#f97316",
	other: "#9ca3af",
};
