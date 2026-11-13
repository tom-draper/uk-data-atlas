import {
	DATASET_FOUNDATION_PARTS,
	DATASET_THEMES,
	DATASET_TOPICS,
	getRegisteredDataset,
	isDatasetTheme,
	isDatasetTopic,
	moduleOfTopic,
	type DatasetModule,
	type DatasetTheme,
	type DatasetTopic,
} from "@uk-data-atlas/datasets/registry";
import { invalidQuery, type ApiResponse } from "../runtime/index.ts";

/**
 * Where a dataset sits in the registry: its theme, its topic and the module it
 * is downloaded in. The registry is the only source of these; the API keeps no
 * list of its own, so a dataset moving topic moves here with no other change.
 */
export type DatasetTaxonomy = {
	theme: DatasetTheme;
	topic: DatasetTopic;
	module: DatasetModule;
};

/**
 * Catalogue ids that differ from the registry's. The disadvantage dataset is
 * catalogued under the id of its declaration and registered under the public
 * id of its docs page.
 */
const REGISTRY_IDS: Readonly<Record<string, string>> = {
	"school-performance-disadvantage": "school-performance-gap",
};

export const taxonomyOfDataset = (
	datasetId: string,
): DatasetTaxonomy | undefined => {
	const registered = getRegisteredDataset(
		REGISTRY_IDS[datasetId] ?? datasetId,
	);
	return registered
		? {
				theme: registered.theme,
				topic: registered.topic,
				module: moduleOfTopic(registered.topic),
			}
		: undefined;
};

/**
 * A measure is filed where its first source's dataset is. Every published
 * measure draws on datasets of one topic, so the first is all of them.
 */
export const taxonomyOfMeasure = (measure: {
	sources: ReadonlyArray<{ datasetId: string }>;
}): DatasetTaxonomy | undefined => {
	for (const source of measure.sources) {
		const taxonomy = taxonomyOfDataset(source.datasetId);
		if (taxonomy) return taxonomy;
	}
	return undefined;
};

/** The three fields on a response, or nothing for a dataset not registered. */
export const withTaxonomy = <T extends object>(
	item: T,
	taxonomy: DatasetTaxonomy | undefined,
): T & Partial<DatasetTaxonomy> =>
	taxonomy
		? {
				...item,
				theme: taxonomy.theme,
				topic: taxonomy.topic,
				module: taxonomy.module,
			}
		: item;

export const TAXONOMY_FILTERS = ["theme", "topic", "module"] as const;
type TaxonomyFilter = (typeof TAXONOMY_FILTERS)[number];

const MODULE_IDS: readonly string[] = [
	...new Set(DATASET_TOPICS.map((topic) => moduleOfTopic(topic.id))),
	...DATASET_FOUNDATION_PARTS.map((part) => part.id),
];

const ACCEPTED: Record<TaxonomyFilter, readonly string[]> = {
	theme: DATASET_THEMES.map((theme) => theme.id),
	topic: DATASET_TOPICS.map((topic) => topic.id),
	module: MODULE_IDS,
};

const isKnown: Record<TaxonomyFilter, (value: string) => boolean> = {
	theme: isDatasetTheme,
	topic: isDatasetTopic,
	module: (value) => MODULE_IDS.includes(value),
};

export type TaxonomyQuery = Partial<Record<TaxonomyFilter, string>>;

/**
 * The `theme`, `topic` and `module` filters of a listing. A value the registry
 * does not hold is a bad request that names the ones it does, never an empty
 * list, so a misspelt theme cannot read as a theme with nothing in it.
 */
export const readTaxonomyQuery = (
	searchParams: URLSearchParams,
): TaxonomyQuery | ApiResponse => {
	const query: TaxonomyQuery = {};
	for (const filter of TAXONOMY_FILTERS) {
		const value = searchParams.get(filter);
		if (value === null) continue;
		if (!isKnown[filter](value))
			return invalidQuery(
				`"${value}" is not a ${filter}. Use one of: ${ACCEPTED[filter].join(", ")}.`,
				{
					code: "unknown_filter_value",
					parameter: filter,
					members: [...ACCEPTED[filter]],
				},
			);
		query[filter] = value;
	}
	return query;
};

export const isTaxonomyQuery = (
	value: TaxonomyQuery | ApiResponse,
): value is TaxonomyQuery => !("status" in value);

export const matchesTaxonomy = (
	taxonomy: DatasetTaxonomy | undefined,
	query: TaxonomyQuery,
) =>
	TAXONOMY_FILTERS.every(
		(filter) =>
			query[filter] === undefined || taxonomy?.[filter] === query[filter],
	);
