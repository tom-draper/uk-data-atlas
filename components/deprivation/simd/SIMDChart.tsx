"use client";
import type {
	AggregatedSIMDData,
	SIMDDataZoneData,
	SIMDDataset,
} from "@lib/types";
import type { DeprivationIndex } from "../DeprivationChart";
import { createDeprivationChart } from "../createDeprivationChart";

const SIMD: DeprivationIndex = {
	datasetType: "simd",
	label: "SIMD",
	region: "Scotland",
	attribution:
		"Scottish Government. Scottish Index of Multiple Deprivation 2020v2. gov.scot",
	metric: "rank",
	metricMaximum: 6976,
	areaNoun: "data zones",
};

export default createDeprivationChart<
	SIMDDataset,
	SIMDDataZoneData,
	AggregatedSIMDData
>({
	index: SIMD,
	fineAreaType: "dataZone",
	authorityStats: (dataset) => dataset.councilStats,
	areaView: (record) => ({
		decile: record.simdDecile,
		detail: { kind: "rank", value: record.simdRank },
	}),
});
