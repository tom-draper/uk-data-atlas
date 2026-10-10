"use client";
import type { AggregatedWIMDData, WIMDLSOAData, WIMDDataset } from "@lib/types";
import type { DeprivationIndex } from "../DeprivationChart";
import { createDeprivationChart } from "../createDeprivationChart";

const WIMD: DeprivationIndex = {
	datasetType: "wimd",
	label: "WIMD",
	region: "Wales",
	attribution:
		"Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales",
	metric: "score",
	metricMaximum: 86.6,
	areaNoun: "LSOAs",
};

export default createDeprivationChart<
	WIMDDataset,
	WIMDLSOAData,
	AggregatedWIMDData
>({
	index: WIMD,
	fineAreaType: "lsoa",
	authorityStats: (dataset) => dataset.ladStats,
	areaView: (record) => ({
		decile: record.wimdDecile,
		detail: { kind: "score", value: record.wimdScore },
	}),
});
