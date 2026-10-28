import type { DataCatalog, Measure } from "./dataCatalog";

/**
 * How a measure is found by the words people use for it. An id or a reviewed
 * alias names exactly one measure and is accepted wherever an id is; a search
 * term may match many, and is only ever a search.
 */

import { measureSlug } from "@uk-data-atlas/catalogue";

// A plural and its singular are one word here, so "house prices" meets
// "house price". Short words such as "gas" are left alone.
const stem = (word: string) =>
	word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
		? word.slice(0, -1)
		: word;

const words = (term: string) =>
	measureSlug(term).split("-").filter(Boolean).map(stem);

const identitiesByCatalog = new WeakMap<
	DataCatalog,
	{ ids: Set<string>; terms: Map<string, string> }
>();

/** The measure an id or alias names, or undefined when it names none. */
export const canonicalMeasureId = (
	catalog: DataCatalog,
	term: string,
): string | undefined => {
	let identities = identitiesByCatalog.get(catalog);
	if (!identities) {
		const ids = new Set<string>();
		const terms = new Map<string, string>();
		for (const measure of catalog.measures) {
			ids.add(measure.id);
			for (const name of [measure.id, ...(measure.aliases ?? [])]) {
				if (!terms.has(name)) terms.set(name, measure.id);
			}
		}
		identities = { ids, terms };
		identitiesByCatalog.set(catalog, identities);
	}
	return identities.ids.has(term)
		? term
		: identities.terms.get(measureSlug(term));
};

const containsAll = (haystack: Set<string>, needles: string[]) =>
	needles.every((needle) => haystack.has(needle));

type MeasureWords = {
	label: Set<string>;
	identity: Set<string>;
	everything: Set<string>;
};

// A catalogue is fixed once loaded, so each measure's words are worked out
// once rather than on every search.
const wordsByCatalog = new WeakMap<DataCatalog, Map<Measure, MeasureWords>>();

const measureWords = (catalog: DataCatalog) => {
	const cached = wordsByCatalog.get(catalog);
	if (cached) return cached;
	const datasetLabels = new Map(
		catalog.datasets.map((dataset) => [dataset.id, dataset.label]),
	);
	const index = new Map(
		catalog.measures.map((measure) => {
			const label = new Set(words(measure.label));
			const identity = new Set(
				[measure.id, ...(measure.aliases ?? [])].flatMap(words),
			);
			const everything = new Set([
				...label,
				...identity,
				...measure.sources.flatMap(({ datasetId }) =>
					words(datasetLabels.get(datasetId) ?? ""),
				),
			]);
			return [measure, { label, identity, everything }];
		}),
	);
	wordsByCatalog.set(catalog, index);
	return index;
};

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
	{ label, identity, everything }: MeasureWords,
) => {
	if (measure.id === slug || measure.aliases?.includes(slug)) return 1000;
	const extra = (field: Set<string>) =>
		Math.min(field.size - query.length, 99);
	if (containsAll(label, query)) return 400 - extra(label);
	if (containsAll(identity, query)) return 300 - extra(identity);
	return containsAll(everything, query) ? 100 : 0;
};

/** The measures matching a query, best first. */
export const searchMeasures = (catalog: DataCatalog, query: string) => {
	const terms = words(query);
	if (terms.length === 0) return catalog.measures;
	const slug = measureSlug(query);
	const index = measureWords(catalog);
	return catalog.measures
		.map((measure) => ({
			measure,
			score: score(measure, terms, slug, index.get(measure)!),
		}))
		.filter(({ score }) => score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.measure.id.localeCompare(right.measure.id),
		)
		.map(({ measure }) => measure);
};
