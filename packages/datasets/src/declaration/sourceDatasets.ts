import { DECLARED_DATASET_SOURCES } from "./declaredSources.ts";

/**
 * Every dataset each folder in `data/source` feeds. A `meta.json` names one of
 * them in `dataset` (docs/data-organisation.md, task 11), the one the folder is
 * named for, so this table is the only record of a folder that feeds several.
 * Folders are relative to `data/source`. The boundaries and postcodes roots and
 * `core/lookups` feed no dataset and are not listed.
 *
 * Every folder with a `meta.json` must appear here or in `SUPPORT_SOURCES`,
 * or sit in `_staging/` where nothing reads it, so adding a source means
 * saying what it is for ("Staged sources" in the doc lists the staged ones).
 */

/**
 * A dataset source folder: the folder, the dataset ids it feeds, and, for a
 * folder not named after a dataset, why. Every folder sits under its theme
 * and topic and is named for a dataset it feeds (docs/data-organisation.md,
 * "Layout"), or for the dataset a part belongs to, `house-price/<part>`.
 * The exceptions are listed with their reason, so each is a choice.
 */
export type DatasetSource = readonly [
	folder: string,
	datasets: readonly string[],
	exception?: string,
];

/**
 * The folders of sources no declaration owns: the census tables, and the
 * datasets they feed that are declared name themselves in their declarations.
 */
const UNDECLARED_DATASET_SOURCES: readonly DatasetSource[] = [
	[
		"population/population-estimates/census-2021-ts001",
		["census-2021-ts001"],
	],
	[
		"population/population-estimates/census-2021-ts003",
		["census-2021-ts003"],
	],
	[
		"population/population-estimates/census-2021-ts007a",
		["census-2021-ts007a"],
	],
	[
		"population/ethnicity-and-identity/census-2021-ts021",
		["census-2021-ts021"],
	],
	["health/health-status/census-2021-ts037", ["census-2021-ts037"]],
	["housing/housing-stock/census-2021-ts054", ["census-2021-ts054"]],
	["economy/labour-market/census-2021-ts066", ["census-2021-ts066"]],
];

/**
 * Every folder with the datasets it feeds: the declared datasets' (a folder
 * two declarations name feeds both) beside the undeclared ones.
 */
export const DATASET_SOURCES: readonly DatasetSource[] = [
	...UNDECLARED_DATASET_SOURCES,
	...DECLARED_DATASET_SOURCES,
]
	.reduce<DatasetSource[]>((rows, [folder, datasets, exception]) => {
		const at = rows.findIndex(([known]) => known === folder);
		if (at === -1) return [...rows, [folder, datasets, exception]];
		const [, known, reason] = rows[at];
		rows[at] = [
			folder,
			[...known, ...datasets.filter((id) => !known.includes(id))],
			reason ?? exception,
		];
		return rows;
	}, [])
	.map(([folder, datasets, exception]) =>
		exception === undefined
			? [folder, datasets]
			: [folder, datasets, exception],
	);

const CROSSWALK_INPUT =
	"Read as a crosswalk weight input, so it feeds no dataset of its own.";

/** Sources that feed other builds, not a dataset. They live in `core/`. */
export const SUPPORT_SOURCES: Readonly<Record<string, string>> = {
	"core/census-2022-scotland-output-area": CROSSWALK_INPUT,
	"core/population-weighted-centroids/oa-2021-ew-v4": CROSSWALK_INPUT,
	"core/population-weighted-centroids/oa-2022-sc": CROSSWALK_INPUT,
	"core/council-tax-stock/2026": CROSSWALK_INPUT,
	"core/census-2021-lsoa":
		"Input to a crosswalk adapter in services/api/config.",
	"core/census-2021-ni-data-zone":
		"Input to a crosswalk adapter in services/api/config.",
	"core/historic-counties":
		"Read by the named-locations build, not a dataset.",
};
