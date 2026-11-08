/**
 * Weight bases the build adds to a crosswalk's edges from held counts, beside
 * the `area` and `population` a crosswalk artifact can declare as its own.
 * `population` is also added to a crosswalk that does not declare it.
 */
export const WEIGHT_BASES_FROM_COUNTS: Record<string, string> = {
	postcodes: "Live small-user postcodes in the overlap",
	households: "Households in the overlap",
	dwellings: "Dwellings (Council Tax properties) in the overlap",
};
