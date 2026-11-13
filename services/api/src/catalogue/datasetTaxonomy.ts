import {
	DATASET_THEMES,
	DATASET_TOPICS,
	getRegisteredDataset,
	isDatasetTheme,
	isDatasetTopic,
	DATASET_MODULE_IDS,
	moduleOfDataset,
	splitModulesOfDataset,
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
	/**
	 * Modules that hold some of the dataset's rows beside its own, such as the
	 * ShareAlike local elections of `politics-sharealike`. Empty for most.
	 */
	addOnModules: readonly DatasetModule[];
};

/** The registry id of a catalogue dataset: the two now share their ids. */
export const registryIdOfDataset = (datasetId: string): string => datasetId;

export const taxonomyOfDataset = (
	datasetId: string,
): DatasetTaxonomy | undefined => {
	const registered = getRegisteredDataset(registryIdOfDataset(datasetId));
	return registered
		? {
				theme: registered.theme,
				topic: registered.topic,
				module: moduleOfDataset(registered),
				addOnModules: splitModulesOfDataset(registered.id)
					.filter((split) => split.holds === "licensed-rows")
					.map((split) => split.id),
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

const MODULE_IDS: readonly string[] = DATASET_MODULE_IDS;

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

/**
 * Whether a dataset has rows in a module: its own module, or an add-on that
 * holds some of its rows. So `module=politics-sharealike` lists the local
 * elections, whose `module` field stays `politics`.
 */
export const datasetIsInModule = (
	taxonomy: DatasetTaxonomy | undefined,
	module: string,
) =>
	taxonomy !== undefined &&
	(taxonomy.module === module ||
		taxonomy.addOnModules.some((addOn) => addOn === module));

export const matchesTaxonomy = (
	taxonomy: DatasetTaxonomy | undefined,
	query: TaxonomyQuery,
) =>
	TAXONOMY_FILTERS.every((filter) =>
		query[filter] === undefined
			? true
			: filter === "module"
				? datasetIsInModule(taxonomy, query[filter])
				: taxonomy?.[filter] === query[filter],
	);
