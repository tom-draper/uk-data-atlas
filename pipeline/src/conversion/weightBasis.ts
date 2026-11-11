import type { ConversionBasis, Step } from "./crosswalkSteps.ts";
import type { MeasureRow } from "./rules.ts";

/**
 * Which weight basis a measure's splits would be apportioned on.
 *
 * A basis only matters where a value is split. A whole-area regrouping gives
 * the same value on every basis, so a series that only regroups carries the
 * basis it would have been split on and nothing else changes.
 *
 * The order of preference, first that applies and has weights on the route:
 *
 * 1. The basis of the measure's subject: households for a count of households
 *    or a measure of them, dwellings for housing stock, meters and premises,
 *    population for people.
 * 2. Population, because a person count is what most held measures follow.
 * 3. Households, then dwellings, then postcodes: the other bases in the order
 *    of how well they track people.
 *
 * Land area is the subject of a few measures but is not a conversion basis,
 * because a measure is never spread by area, so those fall to population.
 */

export const FALLBACK_BASES: readonly ConversionBasis[] = [
	"population",
	"households",
	"dwellings",
	"postcodes",
];

const SUBJECTS: readonly [RegExp, ConversionBasis][] = [
	[/household/, "households"],
	[/dwelling|housing|meter|premises|propert/, "dwellings"],
];

/** The basis a measure's subject points to, or population where it points to none. */
export const subjectBasis = (
	measure: Pick<MeasureRow, "slug" | "unit">,
): ConversionBasis => {
	const text = `${measure.slug} ${measure.unit}`.toLowerCase();
	for (const [pattern, basis] of SUBJECTS)
		if (pattern.test(text)) return basis;
	return "population";
};

/** Every basis, the measure's own first, with none repeated. */
export const basisOrder = (
	measure: Pick<MeasureRow, "slug" | "unit">,
): ConversionBasis[] => [
	...new Set([subjectBasis(measure), ...FALLBACK_BASES]),
];

/** How many sources a step cannot carry only for want of a weight on its basis. */
export const missingWeights = (steps: readonly Step[]) =>
	steps.reduce(
		(sum, step) =>
			sum +
			[...step.blocked.values()].filter(
				(block) => block.reason === "no-weight",
			).length,
		0,
	);

/**
 * The first basis in the measure's order whose route has no source left
 * unweighted. Where none is complete, the one that leaves the fewest, the
 * earlier of equals.
 */
export const chooseBasis = (
	measure: Pick<MeasureRow, "slug" | "unit">,
	stepsOn: (basis: ConversionBasis) => readonly Step[],
): ConversionBasis => {
	let best: { basis: ConversionBasis; missing: number } | undefined;
	for (const basis of basisOrder(measure)) {
		const missing = missingWeights(stepsOn(basis));
		if (missing === 0) return basis;
		if (!best || missing < best.missing) best = { basis, missing };
	}
	return best!.basis;
};
