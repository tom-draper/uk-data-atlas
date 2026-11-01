export const SIMILAR_AREA_METHODS = [
	"zscore-euclidean",
	"rank-euclidean",
] as const;

export type SimilarAreaMethod = (typeof SIMILAR_AREA_METHODS)[number];

export type SimilarAreaValue = {
	areaCode: string;
	value: number;
};

export type SimilarAreaMeasure = {
	id: string;
	values: readonly SimilarAreaValue[];
};

export type SimilarAreaScaling = {
	measureId: string;
	mean: number;
	standardDeviation: number;
};

export type SimilarAreaResult = {
	scaling: SimilarAreaScaling[];
	droppedAreaCount: number;
	areas: Array<{
		areaCode: string;
		distance: number;
		rank: number;
		values: Record<string, number>;
	}>;
};

const statistics = (values: readonly number[]) => {
	const mean =
		values.reduce((total, value) => total + value, 0) / values.length;
	const variance =
		values.reduce((total, value) => total + (value - mean) ** 2, 0) /
		values.length;
	return { mean, standardDeviation: Math.sqrt(variance) };
};

const averageRanks = (values: ReadonlyMap<string, number>) => {
	const ordered = [...values.entries()].sort(
		([leftCode, leftValue], [rightCode, rightValue]) =>
			leftValue - rightValue || leftCode.localeCompare(rightCode),
	);
	const ranks = new Map<string, number>();
	let index = 0;
	while (index < ordered.length) {
		const value = ordered[index]![1];
		let end = index + 1;
		while (end < ordered.length && ordered[end]![1] === value) end += 1;
		const rank = (index + 1 + end) / 2;
		for (const [code] of ordered.slice(index, end)) ranks.set(code, rank);
		index = end;
	}
	return ranks;
};

/**
 * Finds nearest areas over values that share all selected measures. A measure
 * with no variation cannot distinguish areas, so it contributes zero distance.
 */
export const similarAreas = ({
	targetAreaCode,
	measures,
	method,
	limit,
}: {
	targetAreaCode: string;
	measures: readonly SimilarAreaMeasure[];
	method: SimilarAreaMethod;
	limit: number;
}): SimilarAreaResult => {
	const valueMaps = measures.map(
		({ values }) =>
			new Map(values.map(({ areaCode, value }) => [areaCode, value])),
	);
	const targetValues = valueMaps.map((values) => values.get(targetAreaCode));
	if (targetValues.some((value) => value === undefined))
		throw new Error("The target area must have every selected measure.");
	const allCodes = new Set(valueMaps.flatMap((values) => [...values.keys()]));
	const candidateCodes = [...allCodes].filter(
		(areaCode) =>
			areaCode !== targetAreaCode &&
			valueMaps.every((values) => values.has(areaCode)),
	);
	const droppedAreaCount =
		allCodes.size -
		candidateCodes.length -
		(allCodes.has(targetAreaCode) ? 1 : 0);
	const scaling = measures.map(({ id }, index) => {
		const values = [...valueMaps[index]!.values()];
		return { measureId: id, ...statistics(values) };
	});
	const ranks = valueMaps.map(averageRanks);
	const target = targetValues.map((value) => value!);
	const areas = candidateCodes.map((areaCode) => {
		const values = Object.fromEntries(
			measures.map(({ id }, index) => [
				id,
				valueMaps[index]!.get(areaCode)!,
			]),
		);
		const squaredDistance = measures.reduce((total, _measure, index) => {
			const standardDeviation = scaling[index]!.standardDeviation;
			if (standardDeviation === 0) return total;
			const candidate = valueMaps[index]!.get(areaCode)!;
			const difference =
				method === "zscore-euclidean"
					? (candidate - target[index]!) / standardDeviation
					: ranks[index]!.get(areaCode)! -
						ranks[index]!.get(targetAreaCode)!;
			return total + difference ** 2;
		}, 0);
		return { areaCode, distance: Math.sqrt(squaredDistance), values };
	});
	areas.sort(
		(left, right) =>
			left.distance - right.distance ||
			left.areaCode.localeCompare(right.areaCode),
	);
	return {
		scaling,
		droppedAreaCount,
		areas: areas.slice(0, limit).map((area, index) => ({
			...area,
			rank: index + 1,
		})),
	};
};
