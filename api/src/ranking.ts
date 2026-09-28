import type { PopulationObservation } from "./dataCatalog";

export type RankingOrder = "asc" | "desc";

export type RankedObservation = PopulationObservation & {
	rank: number;
	tieCount: number;
};

/**
 * Rank a homogeneous source partition using competition ranking: tied values
 * share a rank and the following rank accounts for every preceding record
 * (1, 1, 3 rather than 1, 1, 2). Codes break display order only, never ties.
 */
export const rankObservations = (
	records: PopulationObservation[],
	order: RankingOrder,
): RankedObservation[] => {
	const sorted = [...records].sort((left, right) => {
		const valueOrder =
			order === "desc"
				? right.value - left.value
				: left.value - right.value;
		return valueOrder || left.areaCode.localeCompare(right.areaCode);
	});
	const tieCounts = new Map<number, number>();
	for (const record of sorted) {
		tieCounts.set(record.value, (tieCounts.get(record.value) ?? 0) + 1);
	}
	let previousValue: number | undefined;
	let previousRank = 0;
	return sorted.map((record, index) => {
		const rank = previousValue === record.value ? previousRank : index + 1;
		previousValue = record.value;
		previousRank = rank;
		return { ...record, rank, tieCount: tieCounts.get(record.value) ?? 1 };
	});
};

/** An `order` query value: descending unless asc is asked for. */
export const readRankingOrder = (
	value: string | null,
): RankingOrder | undefined =>
	value === null || value === "desc"
		? "desc"
		: value === "asc"
			? "asc"
			: undefined;
