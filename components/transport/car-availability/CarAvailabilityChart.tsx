"use client";

import {
	BreakdownChart,
	type BreakdownChartConfig,
	type BreakdownChartProps,
} from "@/components/BreakdownChart";
import {
	CAR_AVAILABILITY_COLORS,
	CAR_AVAILABILITY_LEVELS,
	type CarAvailabilityKey,
} from "@/lib/types/carAvailability";

const config: BreakdownChartConfig<CarAvailabilityKey> = {
	datasetType: "carAvailability",
	heading: "Car Availability",
	coverage: "England & Wales",
	source: "Office for National Statistics. Census 2021: Car or van availability, England and Wales. TS045.",
	categories: CAR_AVAILABILITY_LEVELS,
	colors: CAR_AVAILABILITY_COLORS,
	accent: "noCar",
};

export default function CarAvailabilityChart(
	props: BreakdownChartProps<CarAvailabilityKey>,
) {
	return <BreakdownChart {...props} config={config} />;
}
