import type { Measure } from "../dataCatalog";

/**
 * Measures that answer the same question in a nation this one does not cover.
 *
 * The United Kingdom does not publish one deprivation index; it publishes four,
 * one per nation, on different methods and different reference populations. A
 * caller who asks for England's and then looks for Scotland finds nothing, and
 * nothing in the catalogue tells them where to look or warns them off putting
 * the two on one scale.
 *
 * This is a declaration rather than a computation, because whether two measures
 * answer the same question is a judgement about the statistics and not
 * something the catalogue can derive. Each entry names the concept, the
 * measures that cover it, and whether they may be read together. For the
 * national indices they may not, and the reason travels with the link so a
 * refusal or a client can repeat it.
 */
export type NationalVariant = {
	concept: string;
	measureIds: string[];
	comparable: boolean;
	reason: string;
};

export const NATIONAL_VARIANTS: NationalVariant[] = [
	{
		concept: "index-of-multiple-deprivation-rank",
		measureIds: ["imd-rank", "wimd-rank", "simd-rank", "nimdm-rank"],
		comparable: false,
		reason: "Each nation builds its index from its own domains, weights and reference population, and ranks its own areas from 1. A rank in one nation says nothing about a rank in another, and the four cannot be placed on a single scale.",
	},
	{
		concept: "index-of-multiple-deprivation-decile",
		measureIds: ["imd-decile", "wimd-decile", "simd-decile"],
		comparable: false,
		reason: "Each decile divides that nation's own areas into ten, so the first decile means the most deprived tenth of that nation and not of the United Kingdom. Northern Ireland publishes no decile alongside its rank.",
	},
];

/** Where a measure's own coverage ends, and what covers the rest. */
export type MeasureElsewhere = {
	measureId: string;
	countries: string[];
	comparable: boolean;
	reason: string;
	href: string;
};

const countriesOf = (measure: Measure) => [
	...new Set(
		measure.sources.flatMap((source) =>
			source.coverage.kind === "partial" ? source.coverage.countries : [],
		),
	),
];

/**
 * Add each measure's national variants to it, so a measure carries the edge of
 * its own coverage. A variant the catalogue does not publish is left out
 * rather than linked to nothing.
 */
export const withNationalVariants = (measures: Measure[]): Measure[] => {
	const byId = new Map(measures.map((measure) => [measure.id, measure]));
	for (const variant of NATIONAL_VARIANTS) {
		const missing = variant.measureIds.filter((id) => !byId.has(id));
		if (missing.length === variant.measureIds.length)
			throw new Error(
				`No measure of ${variant.concept} is published, so the declaration names nothing.`,
			);
	}
	return measures.map((measure) => {
		const variant = NATIONAL_VARIANTS.find((entry) =>
			entry.measureIds.includes(measure.id),
		);
		if (!variant) return measure;
		const elsewhere = variant.measureIds
			.filter((id) => id !== measure.id)
			.flatMap((id): MeasureElsewhere[] => {
				const other = byId.get(id);
				return other
					? [
							{
								measureId: id,
								countries: countriesOf(other),
								comparable: variant.comparable,
								reason: variant.reason,
								href: `/v1/measures/${id}`,
							},
						]
					: [];
			});
		return elsewhere.length === 0
			? measure
			: { ...measure, concept: variant.concept, elsewhere };
	});
};
