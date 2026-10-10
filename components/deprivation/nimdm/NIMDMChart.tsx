"use client";
import type {
	AggregatedNIMDMData,
	NIMDMLSOAData,
	NIMDMDataset,
} from "@lib/types";
import type { DeprivationIndex } from "../DeprivationChart";
import { createDeprivationChart } from "../createDeprivationChart";

const NIMDM: DeprivationIndex = {
	datasetType: "nimdm",
	label: "NIMDM",
	region: "Northern Ireland",
	attribution:
		"NISRA. Northern Ireland Multiple Deprivation Measure 2017. nisra.gov.uk",
	metric: "rank",
	metricMaximum: 890,
	areaNoun: "super output areas",
};

export default createDeprivationChart<
	NIMDMDataset,
	NIMDMLSOAData,
	AggregatedNIMDMData
>({
	index: NIMDM,
	fineAreaType: "superOutputArea",
	authorityStats: (dataset) => dataset.lgdStats,
	areaView: (record) => ({
		// NISRA publishes no decile for these areas, so none is shown.
		decile: null,
		detail: { kind: "rank", value: record.nimdmRank },
	}),
});
