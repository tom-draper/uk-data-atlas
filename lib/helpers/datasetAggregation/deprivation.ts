import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { AggregatedIMDData, IMDDataset } from "@/lib/types/imd";
import type { AggregatedNIMDMData, NIMDMDataset } from "@/lib/types/nimdm";
import type { AggregatedSIMDData, SIMDDataset } from "@/lib/types/simd";
import type { AggregatedWIMDData, WIMDDataset } from "@/lib/types/wimd";

export function aggregateSIMD(
	features: Features,
	codeProperty: PropertyKeys,
	data: SIMDDataset["data"],
): AggregatedSIMDData | null {
	let rank = 0, quintile = 0, decile = 0, count = 0;
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!record) continue;
		rank += record.simdRank;
		quintile += record.simdQuintile;
		decile += record.simdDecile;
		count++;
	}
	return count === 0 ? null : {
		averageSIMDRank: rank / count,
		averageSIMDQuintile: quintile / count,
		averageSIMDDecile: decile / count,
	};
}

export function aggregateWIMD(
	features: Features,
	codeProperty: PropertyKeys,
	data: WIMDDataset["data"],
): AggregatedWIMDData | null {
	let score = 0, rank = 0, decile = 0, count = 0;
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!record) continue;
		score += record.wimdScore;
		rank += record.wimdRank;
		decile += record.wimdDecile;
		count++;
	}
	return count === 0 ? null : {
		averageWIMDScore: score / count,
		averageWIMDRank: rank / count,
		averageWIMDDecile: decile / count,
	};
}

export function aggregateNIMDM(
	features: Features,
	codeProperty: PropertyKeys,
	data: NIMDMDataset["data"],
): AggregatedNIMDMData | null {
	let rank = 0, decile = 0, count = 0;
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!record) continue;
		rank += record.nimdmRank;
		decile += record.nimdmDecile;
		count++;
	}
	return count === 0 ? null : {
		averageNIMDMRank: rank / count,
		averageNIMDMDecile: decile / count,
	};
}

export function aggregateIMD(
	features: Features,
	codeProperty: PropertyKeys,
	data: IMDDataset["data"],
): AggregatedIMDData {
	let score = 0, decile = 0, count = 0;
	for (const feature of features) {
		const record = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!record) continue;
		score += record.imdScore;
		decile += record.imdDecile;
		count++;
	}
	return {
		averageIMDScore: count > 0 ? score / count : 0,
		averageIMDDecile: count > 0 ? decile / count : 0,
	};
}
