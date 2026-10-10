import type { ChartDatasetMap } from "./types";

/**
 * The map presentation of a deprivation index published as ranks, where rank 1
 * is the most deprived of `areaCount`. Ranks run low to high on the colour
 * scale, so the legend reads them back as "Rank n" between its two ends.
 */
export function deprivationRankMap<T>(
	valueKey: string,
	areaCount: number,
): ChartDatasetMap<T> {
	return {
		valueKey,
		colorRange: { min: 1, max: areaCount },
		legend: {
			min: 1,
			max: areaCount,
			format: (value) => {
				const rank = areaCount + 1 - value;
				return rank <= 1
					? "Most deprived"
					: rank >= areaCount
						? "Least deprived"
						: `Rank ${Math.round(rank).toLocaleString()}`;
			},
		},
		invertColor: false,
	};
}
