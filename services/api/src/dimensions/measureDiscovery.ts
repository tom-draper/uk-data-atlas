import { measureSlug } from "@uk-data-atlas/catalogue";
import type {
	DataCatalog,
	MeasureSource,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type {
	Dimension,
	DimensionalMeasure,
	DimensionCatalogue,
	Series,
} from "./dimensionCatalogue";

/**
 * Measures as `/v1/measures` lists them: what is measured, its dimensions
 * and members, and the series published for each combination. Fields a
 * catalogue measure carried (unit, aggregation, sources, links) stay at the
 * top level, so a client that read them before still finds them.
 */

const sourceKey = (source: MeasureSource) =>
	JSON.stringify([
		source.datasetId,
		source.sourceGeography.type,
		source.sourceGeography.boundaryYear,
		source.periods,
	]);

/** A request for one series, in measure-and-filter form. */
export const seriesHref = (measure: DimensionalMeasure, series: Series) => {
	const query = new URLSearchParams(series.dimensions);
	if (series.datasetId) query.set("datasetId", series.datasetId);
	const search = query.toString();
	return `/v1/data/${measure.id}${search ? `?${search}` : ""}`;
};

export const describeMeasure = (
	measure: DimensionalMeasure,
	documents?: { has: (id: string) => boolean },
) => {
	const first = measure.series[0]!.catalogueMeasure;
	const single = measure.series.length === 1 ? first : undefined;
	const sources = new Map<string, MeasureSource>();
	for (const series of measure.series)
		for (const source of series.catalogueMeasure.sources)
			if (!sources.has(sourceKey(source)))
				sources.set(sourceKey(source), source);
	const aliases = [
		...new Set(
			measure.series.flatMap(
				(series) => series.catalogueMeasure.aliases ?? [],
			),
		),
	].sort();
	return {
		id: measure.id,
		label: measure.label,
		description: measure.description,
		valueKind: first.valueKind,
		unit: first.unit,
		...(first.unitDefinition
			? { unitDefinition: first.unitDefinition }
			: {}),
		...(aliases.length > 0 ? { aliases } : {}),
		...(single?.concept ? { concept: single.concept } : {}),
		...(single?.elsewhere ? { elsewhere: single.elsewhere } : {}),
		...(single?.derivedFrom ? { derivedFrom: single.derivedFrom } : {}),
		...(single?.uncertainty ? { uncertainty: single.uncertainty } : {}),
		...(single?.notes ? { notes: single.notes } : {}),
		aggregation: first.aggregation,
		dimensions: measure.dimensions,
		...(Object.keys(measure.defaults).length > 0
			? { defaults: measure.defaults }
			: {}),
		series: measure.series.map((series) => {
			const catalogued = series.catalogueMeasure;
			return {
				dimensions: series.dimensions,
				...(series.datasetId ? { datasetId: series.datasetId } : {}),
				label: catalogued.label,
				...(catalogued.unit !== first.unit
					? { unit: catalogued.unit }
					: {}),
				...(series.id !== measure.id
					? { deprecatedAlias: series.id }
					: {}),
				href: seriesHref(measure, series),
				sources: catalogued.sources,
				...(!single && catalogued.notes
					? { notes: catalogued.notes }
					: {}),
				...(!single && catalogued.uncertainty
					? { uncertainty: catalogued.uncertainty }
					: {}),
				...(documents?.has(`measure-${series.id}`)
					? {
							documents: {
								evidence: `/v1/documents/measure-${series.id}.json`,
							},
						}
					: {}),
			};
		}),
		sources: [...sources.values()],
		availability: first.availability,
		links: { data: `/v1/data/${measure.id}` },
		...(single && documents?.has(`measure-${single.id}`)
			? {
					documents: {
						evidence: `/v1/documents/measure-${single.id}.json`,
					},
				}
			: {}),
	};
};

// A plural and its singular are one word here, so "house prices" meets
// "house price". Short words such as "gas" are left alone.
const stem = (word: string) =>
	word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
		? word.slice(0, -1)
		: word;

const words = (term: string) =>
	measureSlug(term).split("-").filter(Boolean).map(stem);

type Indexed = {
	measure: DimensionalMeasure;
	label: Set<string>;
	identity: Set<string>;
	everything: Set<string>;
	identities: Set<string>;
	members: Array<{
		dimension: Dimension;
		code: string;
		label: string;
		words: Set<string>;
	}>;
};

const indexes = new WeakMap<DimensionCatalogue, Indexed[]>();

const indexOf = (catalog: DataCatalog, catalogue: DimensionCatalogue) => {
	const cached = indexes.get(catalogue);
	if (cached) return cached;
	const datasetLabels = new Map(
		catalog.datasets.map((dataset) => [dataset.id, dataset.label]),
	);
	const built = catalogue.measures.map((measure): Indexed => {
		const identities = new Set([
			measure.id,
			...measure.series.flatMap((series) => [
				series.id,
				...(series.catalogueMeasure.aliases ?? []),
			]),
		]);
		const label = new Set(words(measure.label));
		const identity = new Set([...identities].flatMap(words));
		const everything = new Set([
			...label,
			...identity,
			...measure.dimensions.flatMap((dimension) =>
				words(dimension.label),
			),
			...measure.series.flatMap((series) => [
				...words(series.catalogueMeasure.label),
				...series.catalogueMeasure.sources.flatMap((source) =>
					words(datasetLabels.get(source.datasetId) ?? ""),
				),
			]),
		]);
		const members = measure.dimensions.flatMap((dimension) =>
			dimension.members.map((member) => ({
				dimension,
				code: member.code,
				label: member.label,
				words: new Set([...words(member.label), ...words(member.code)]),
			})),
		);
		return { measure, label, identity, everything, identities, members };
	});
	indexes.set(catalogue, built);
	return built;
};

const containsAll = (haystack: Set<string>, needles: string[]) =>
	needles.every((needle) => haystack.has(needle));

/** A member the query names, with the request that filters on it. */
export type MemberMatch = {
	dimension: string;
	member: string;
	label: string;
	href: string;
};

/**
 * Rank a measure against a query: an exact id or alias first, then every
 * query word in its label, then in its label and one member's, then in its
 * ids, then anywhere. Within a tier, the label with fewest other words wins.
 * The members whose words the query uses are returned with the measure, so
 * "burglary" finds `recorded-crimes` and says to filter on `offence`.
 */
const score = (entry: Indexed, query: string[], slug: string) => {
	const extra = (field: Set<string>) =>
		Math.min(field.size - query.length, 99);
	const named = entry.members.filter(
		(member) =>
			query.some((word) => member.words.has(word)) &&
			query.every(
				(word) => member.words.has(word) || entry.everything.has(word),
			),
	);
	// Prefer the members that use most of the query's words, then the
	// shortest labels, so "burglary" lists burglary before its parts.
	const used = (member: (typeof named)[number]) =>
		query.filter((word) => member.words.has(word)).length;
	const best = Math.max(0, ...named.map(used));
	const members = named
		.filter((member) => used(member) === best)
		.sort((left, right) => left.words.size - right.words.size);
	if (entry.identities.has(slug)) return { score: 1000, members: [] };
	if (containsAll(entry.label, query))
		return { score: 400 - extra(entry.label), members: [] };
	const withMember = members.find((member) =>
		query.every((word) => member.words.has(word) || entry.label.has(word)),
	);
	if (withMember) return { score: 350 - extra(entry.label), members };
	if (containsAll(entry.identity, query))
		return { score: 300 - extra(entry.identity), members: [] };
	if (members.length > 0) return { score: 200, members };
	return containsAll(entry.everything, query)
		? { score: 100, members: [] }
		: { score: 0, members: [] };
};

/** The members an old encoded id fixes, where the query is one. */
const oldIdMembers = (entry: Indexed, slug: string) => {
	const series = entry.measure.series.find(
		(candidate) =>
			candidate.id === slug ||
			candidate.catalogueMeasure.aliases?.includes(slug),
	);
	if (!series || Object.keys(series.dimensions).length === 0)
		return undefined;
	return entry.members.filter(
		(member) => series.dimensions[member.dimension.id] === member.code,
	);
};

/** The measures matching a query, best first, each with the members it names. */
export const searchDimensionalMeasures = (
	catalog: DataCatalog,
	catalogue: DimensionCatalogue,
	query: string,
): Array<{ measure: DimensionalMeasure; members: MemberMatch[] }> => {
	const terms = words(query);
	if (terms.length === 0)
		return catalogue.measures.map((measure) => ({ measure, members: [] }));
	const slug = measureSlug(query);
	return indexOf(catalog, catalogue)
		.map((entry) => ({ entry, ...score(entry, terms, slug) }))
		.filter(({ score }) => score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.entry.measure.id.localeCompare(right.entry.measure.id),
		)
		.map(({ entry, members }) => ({
			measure: entry.measure,
			members: (oldIdMembers(entry, slug) ?? members).map((member) => ({
				dimension: member.dimension.id,
				member: member.code,
				label: member.label,
				href: `/v1/data/${entry.measure.id}?${new URLSearchParams({ [member.dimension.id]: member.code })}`,
			})),
		}));
};
