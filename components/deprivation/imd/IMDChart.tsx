"use client";
import type { AggregatedIMDData, IMDLSOAData, IMDDataset } from "@lib/types";
import type { DeprivationIndex } from "../DeprivationChart";
import { createDeprivationChart } from "../createDeprivationChart";

const IMD: DeprivationIndex = {
	datasetType: "imd",
	label: "IMD",
	region: "England",
	attribution:
		"Ministry of Housing, Communities & Local Government. English Indices of Deprivation 2019. gov.uk",
	metric: "score",
	metricMaximum: 92.735,
	areaNoun: "LSOAs",
};

export default createDeprivationChart<
	IMDDataset,
	IMDLSOAData,
	AggregatedIMDData
>({
	index: IMD,
	fineAreaType: "lsoa",
	authorityStats: (dataset) => dataset.ladStats,
	areaView: (record) => ({
		decile: record.imdDecile,
		detail: { kind: "score", value: record.imdScore },
	}),
});
