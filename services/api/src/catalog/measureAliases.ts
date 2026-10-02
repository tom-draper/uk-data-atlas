import type { Measure } from "../dataCatalog";
import { measureSlug } from "../measureTerms";

/**
 * Other names a measure answers to, accepted wherever its id is. Each names
 * exactly one measure, so it is reviewed rather than inferred: a word that
 * could mean several measures, such as "deprivation" (four national indices)
 * or "unemployment" (a rate, a level and a claimant count), is left to
 * `GET /v1/measures?q=` to list, never chosen for the caller.
 */
export const MEASURE_ALIASES: Readonly<Record<string, string>> = {
	// The id this measure was published under before it was renamed.
	"population-estimate": "population",
	"population-estimates": "population",
	"house-price": "house-price-median",
	"house-prices": "house-price-median",
	jobs: "total-jobs",
	"greenhouse-gas-emissions": "ghg-emissions",
	"gross-domestic-product": "gdp",
	"gross-value-added": "gva",
};

/** Attach each measure's aliases, refusing any that could be misread. */
export const withAliases = (
	measures: Measure[],
	aliases: Readonly<Record<string, string>> = MEASURE_ALIASES,
): Measure[] => {
	const ids = new Set(measures.map((measure) => measure.id));
	const byMeasure = new Map<string, string[]>();
	for (const [alias, measureId] of Object.entries(aliases)) {
		if (measureSlug(alias) !== alias)
			throw new Error(`Measure alias ${alias} is not a plain slug.`);
		if (ids.has(alias))
			throw new Error(`Measure alias ${alias} is already a measure id.`);
		if (!ids.has(measureId))
			throw new Error(
				`Measure alias ${alias} names ${measureId}, which is not published.`,
			);
		byMeasure.set(measureId, [...(byMeasure.get(measureId) ?? []), alias]);
	}
	return measures.map((measure) => {
		const names = byMeasure.get(measure.id);
		return names ? { ...measure, aliases: names.sort() } : measure;
	});
};
