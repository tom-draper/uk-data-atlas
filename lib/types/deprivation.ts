/**
 * How deprived a group of small areas is, told as how many of them rank among
 * their own nation's most deprived tenth.
 *
 * A group's ranks and deciles cannot be averaged: a rank records an order, not
 * a distance, and a decile is a band of ranks. Counting the areas in the most
 * deprived tenth is the summary the publishers use for local authorities, and
 * it means the same thing for a council, a city region or a whole selection.
 */
export interface DeprivationSummary {
	areaCount: number;
	mostDeprivedCount: number;
}

/**
 * A group summarised by an index that publishes scores as well as ranks.
 *
 * A score, unlike a rank, measures how deprived an area is, so a group of
 * areas has a meaningful average: the population-weighted mean of its areas'
 * scores, which is how MHCLG publishes a local authority's average score. The
 * share in the most deprived tenth is kept beside it, because an average can
 * hide a few very deprived areas among many that are not.
 */
export interface ScoredDeprivationSummary extends DeprivationSummary {
	/** Population of the areas the average is taken over. */
	population: number;
	/** Population-weighted mean score, or null where no area has a population. */
	averageScore: number | null;
}
