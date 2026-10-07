"use client";

import {
	BreakdownChart,
	type BreakdownChartConfig,
	type BreakdownChartProps,
} from "@/components/BreakdownChart";
import {
	TRAVEL_TO_WORK_COLORS,
	TRAVEL_TO_WORK_MODES,
	type TravelToWorkMode,
} from "@/lib/types/travelToWork";

const config: BreakdownChartConfig<TravelToWorkMode> = {
	datasetType: "travelToWork",
	heading: "Travel to Work",
	coverage: "England & Wales",
	source: "Office for National Statistics. Census 2021: Method used to travel to workplace, England and Wales. TS061.",
	categories: TRAVEL_TO_WORK_MODES,
	colors: TRAVEL_TO_WORK_COLORS,
	accent: "car",
};

export default function TravelToWorkChart(
	props: BreakdownChartProps<TravelToWorkMode>,
) {
	return <BreakdownChart {...props} config={config} />;
}
