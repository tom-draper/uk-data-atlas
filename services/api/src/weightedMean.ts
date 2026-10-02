export type WeightedObservation = {
	areaCode: string;
	value: number;
};

export type WeightedMeanResult =
	| { kind: "ok"; value: number; totalWeight: number }
	| { kind: "partial_coverage" }
	| { kind: "invalid_weights" };

/** Align value and weight partitions before calculating a weighted mean. */
export const calculateWeightedMean = (
	values: WeightedObservation[],
	weights: WeightedObservation[],
): WeightedMeanResult => {
	const valuesByCode = new Set(values.map((record) => record.areaCode));
	const weightsByCode = new Map(
		weights.map((record) => [record.areaCode, record]),
	);
	if (
		weights.length !== values.length ||
		[...valuesByCode].some((code) => !weightsByCode.has(code))
	)
		return { kind: "partial_coverage" };
	const totalWeight = weights.reduce(
		(total, record) => total + record.value,
		0,
	);
	if (
		!Number.isFinite(totalWeight) ||
		totalWeight <= 0 ||
		weights.some(
			(record) => !Number.isFinite(record.value) || record.value < 0,
		)
	)
		return { kind: "invalid_weights" };
	return {
		kind: "ok",
		value:
			values.reduce(
				(total, record) =>
					total +
					record.value *
						(weightsByCode.get(record.areaCode)?.value ?? 0),
				0,
			) / totalWeight,
		totalWeight,
	};
};
