"use client";

import {
	BreakdownChart,
	type BreakdownChartConfig,
	type BreakdownChartProps,
} from "@/components/BreakdownChart";
import {
	QUALIFICATION_COLORS,
	QUALIFICATION_LEVELS,
	type QualificationKey,
} from "@/lib/types/qualification";

const config: BreakdownChartConfig<QualificationKey> = {
	datasetType: "qualification",
	heading: "Qualifications",
	coverage: "England & Wales",
	source: "Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067.",
	categories: QUALIFICATION_LEVELS,
	colors: QUALIFICATION_COLORS,
	accent: "level4Plus",
};

export default function QualificationChart(
	props: BreakdownChartProps<QualificationKey>,
) {
	return <BreakdownChart {...props} config={config} />;
}
