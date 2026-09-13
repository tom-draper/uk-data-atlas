import type { Features, PropertyKeys } from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import type { DeprivationSummary } from "@/lib/types/deprivation";
import type { IMDDataset, IMDLSOAData } from "@/lib/types/imd";
import type { NIMDMDataset, NIMDMLSOAData } from "@/lib/types/nimdm";
import type { SIMDDataset, SIMDDataZoneData } from "@/lib/types/simd";
import type { WIMDDataset, WIMDLSOAData } from "@/lib/types/wimd";

/**
 * Whether an area is in its nation's most deprived tenth. Where the publisher
 * gives a decile, that decile is used as published.
 */
export const isMostDeprivedIMD = (record: IMDLSOAData) =>
	record.imdDecile === 1;
export const isMostDeprivedWIMD = (record: WIMDLSOAData) =>
	record.wimdDecile === 1;
export const isMostDeprivedSIMD = (record: SIMDDataZoneData) =>
	record.simdDecile === 1;

/**
 * NISRA publishes ranks but no deciles, so the most deprived tenth is read
 * from the rank: a tenth of 890 super output areas is exactly 89.
 */
export const NIMDM_MOST_DEPRIVED_RANK = 89;
export const isMostDeprivedNIMDM = (record: NIMDMLSOAData) =>
	record.nimdmRank <= NIMDM_MOST_DEPRIVED_RANK;

export function summariseDeprivation<TRecord>(
	records: Iterable<TRecord>,
	isMostDeprived: (record: TRecord) => boolean,
): DeprivationSummary | null {
	let areaCount = 0,
		mostDeprivedCount = 0;
	for (const record of records) {
		areaCount++;
		if (isMostDeprived(record)) mostDeprivedCount++;
	}
	return areaCount === 0 ? null : { areaCount, mostDeprivedCount };
}

/** Summarise records keyed by a parent code, such as a local authority. */
export function summariseDeprivationBy<TRecord>(
	records: Iterable<TRecord>,
	parentCode: (record: TRecord) => string,
	isMostDeprived: (record: TRecord) => boolean,
): Record<string, DeprivationSummary> {
	const groups: Record<string, TRecord[]> = {};
	for (const record of records)
		(groups[parentCode(record)] ??= []).push(record);
	const summaries: Record<string, DeprivationSummary> = {};
	for (const [code, group] of Object.entries(groups)) {
		const summary = summariseDeprivation(group, isMostDeprived);
		if (summary) summaries[code] = summary;
	}
	return summaries;
}

function recordsFor<TRecord>(
	features: Features,
	codeProperty: PropertyKeys,
	data: Record<string, TRecord>,
): TRecord[] {
	const seen = new Set<string>();
	const records: TRecord[] = [];
	for (const feature of features) {
		const code = getFeatureProp(feature.properties, codeProperty) ?? "";
		// A split boundary can repeat a code; each area counts once.
		if (seen.has(code)) continue;
		seen.add(code);
		const record = data[code];
		if (record) records.push(record);
	}
	return records;
}

export const aggregateIMD = (
	features: Features,
	codeProperty: PropertyKeys,
	data: IMDDataset["data"],
) =>
	summariseDeprivation(
		recordsFor(features, codeProperty, data),
		isMostDeprivedIMD,
	);

export const aggregateWIMD = (
	features: Features,
	codeProperty: PropertyKeys,
	data: WIMDDataset["data"],
) =>
	summariseDeprivation(
		recordsFor(features, codeProperty, data),
		isMostDeprivedWIMD,
	);

export const aggregateSIMD = (
	features: Features,
	codeProperty: PropertyKeys,
	data: SIMDDataset["data"],
) =>
	summariseDeprivation(
		recordsFor(features, codeProperty, data),
		isMostDeprivedSIMD,
	);

export const aggregateNIMDM = (
	features: Features,
	codeProperty: PropertyKeys,
	data: NIMDMDataset["data"],
) =>
	summariseDeprivation(
		recordsFor(features, codeProperty, data),
		isMostDeprivedNIMDM,
	);
