import type { DataCatalog, Measure } from "./dataCatalog";

/**
 * How a measure is found by the words people use for it. An id or a reviewed
 * alias names exactly one measure and is accepted wherever an id is; a search
 * term may match many, and is only ever a search.
 */

/** A term as a slug: lower case, no accents, words joined by hyphens. */
export const measureSlug = (term: string) =>
	term
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

// A plural and its singular are one word here, so "house prices" meets
// "house price". Short words such as "gas" are left alone.
const stem = (word: string) =>
	word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
		? word.slice(0, -1)
		: word;

const words = (term: string) =>
	measureSlug(term).split("-").filter(Boolean).map(stem);

/** The measure an id or alias names, or undefined when it names none. */
export const canonicalMeasureId = (
	catalog: DataCatalog,
	term: string,
): string | undefined => {
	if (catalog.measures.some((measure) => measure.id === term)) return term;
	const slug = measureSlug(term);
	return catalog.measures.find(
		(measure) => measure.id === slug || measure.aliases?.includes(slug),
	)?.id;
};

const containsAll = (haystack: Set<string>, needles: string[]) =>
	needles.every((needle) => haystack.has(needle));

/**
 * Rank a measure against a query: an exact id or alias first, then every
 * query word in its label, then in its id or aliases, then anywhere including
 * its datasets' titles. Within a tier, the label with fewest other words
 * wins, so "population" puts population before population density.
 */
const score = (
	measure: Measure,
	query: string[],
	slug: string,
	datasetLabels: Map<string, string>,
) => {
	if (measure.id === slug || measure.aliases?.includes(slug)) return 1000;
	const label = new Set(words(measure.label));
	const identity = new Set(
		[measure.id, ...(measure.aliases ?? [])].flatMap(words),
	);
	const extra = (field: Set<string>) =>
		Math.min(field.size - query.length, 99);
	if (containsAll(label, query)) return 400 - extra(label);
	if (containsAll(identity, query)) return 300 - extra(identity);
	const everything = new Set([
		...label,
		...identity,
		...measure.sources.flatMap(({ datasetId }) =>
			words(datasetLabels.get(datasetId) ?? ""),
		),
	]);
	return containsAll(everything, query) ? 100 : 0;
};

/** The measures matching a query, best first. */
export const searchMeasures = (catalog: DataCatalog, query: string) => {
	const terms = words(query);
	if (terms.length === 0) return catalog.measures;
	const slug = measureSlug(query);
	const datasetLabels = new Map(
		catalog.datasets.map((dataset) => [dataset.id, dataset.label]),
	);
	return catalog.measures
		.map((measure) => ({
			measure,
			score: score(measure, terms, slug, datasetLabels),
		}))
		.filter(({ score }) => score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.measure.id.localeCompare(right.measure.id),
		)
		.map(({ measure }) => measure);
};
