/**
 * Dataset ids that were retired when datasets split by geography or history
 * were merged into one. Each still resolves: to the merged dataset, and where
 * the old id meant one slice of it, to that geography or period.
 *
 * Plain data with no imports, because next.config.ts reads it to redirect the
 * old website addresses. Add an entry whenever a dataset id is retired; never
 * reuse a retired id for a different dataset.
 */
export type DatasetAlias = {
	/** The dataset that replaced the retired id. */
	dataset: string;
	/** The boundary type the retired id was published at, when it was one. */
	geography?: string;
	/** The period the retired id covered, when it was one slice of the history. */
	period?: string;
};

export const DATASET_ALIASES: Readonly<Record<string, DatasetAlias>> = {
	"regional-gdp-itl1": { dataset: "regional-gdp", geography: "itl1" },
	"regional-gdp-itl2": { dataset: "regional-gdp", geography: "itl2" },
	"regional-gdp-itl3": { dataset: "regional-gdp", geography: "itl3" },
	"school-performance-constituency": {
		dataset: "school-performance",
		geography: "constituency",
	},
};

/** The alias a dataset id retired into, if it is one. */
export const datasetAliasOf = (id: string): DatasetAlias | undefined =>
	Object.hasOwn(DATASET_ALIASES, id) ? DATASET_ALIASES[id] : undefined;
