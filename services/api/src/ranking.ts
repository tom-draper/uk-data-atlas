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
	records: readonly PopulationObservation[],
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

/** One partition ranked in one order, read a page at a time. */
export type Ranking = {
	length: number;
	slice(start: number, end: number): RankedObservation[];
	positionOf(areaCode: string): number;
};

/** Partitions ranked recently. Paging through one ranks it once. */
const MAX_CACHED_RANKINGS = 32;
const rankings = new Map<
	readonly PopulationObservation[],
	Partial<Record<RankingOrder, Ranking>>
>();

/**
 * `rankObservations` for a published partition, remembered for the most
 * recently ranked partitions. Keyed by the partition's records array, which
 * a loaded artifact keeps for as long as the server runs.
 */
export const rankingOf = (
	records: readonly PopulationObservation[],
	order: RankingOrder,
): Ranking => {
	const orders = rankings.get(records) ?? {};
	// Re-inserting keeps the map in least-recently-used order.
	rankings.delete(records);
	rankings.set(records, orders);
	if (rankings.size > MAX_CACHED_RANKINGS)
		rankings.delete(rankings.keys().next().value!);
	const cached = orders[order];
	if (cached) return cached;
	const ranked = rankObservations(records, order);
	const positions = new Map(
		ranked.map((record, index) => [record.areaCode, index]),
	);
	const ranking: Ranking = {
		length: ranked.length,
		slice: (start, end) => ranked.slice(start, end),
		positionOf: (areaCode) => positions.get(areaCode) ?? -1,
	};
	orders[order] = ranking;
	return ranking;
};
