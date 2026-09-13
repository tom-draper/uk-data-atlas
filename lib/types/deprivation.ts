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
