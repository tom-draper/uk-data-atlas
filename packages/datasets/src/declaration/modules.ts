import {
	DATASET_FOUNDATION_PARTS,
	DATASET_MODULE_IDS,
	DATASET_SPLIT_MODULES,
	DATASET_THEMES,
	getDatasetTopic,
	moduleOfDataset,
	type DatasetFoundationPart,
	type DatasetModule,
	type DatasetSplitModuleInfo,
	type DatasetTheme,
	type DatasetTopic,
} from "./taxonomy.ts";
import { REGISTERED_DATASETS } from "./tree.ts";

/**
 * Module manifests, derived from the registry. A module is a download unit
 * (docs/data-organisation.md, "Modules"): one per theme, plus the foundation
 * parts. The manifest is what the dist tree writes beside each module and
 * what `/v1/modules` serves, so both read `buildModuleManifests` and neither
 * keeps a list of its own. Which datasets a module holds is `moduleOfDataset`
 * and the split definitions in the taxonomy, so a split such as
 * `population-detail` changes those and nothing here.
 *
 * This file is pure: licences are passed in, because the files that record
 * them (`meta.json`) are not on every machine that builds a manifest.
 */

/**
 * The compatibility key every module declares. A module joins to the tables in
 * core, so it names the generation of core it was built against. Bump it when
 * a change to core would break a module built before it; the assembler (task
 * 13) refuses to combine modules whose keys differ from core's.
 */
export const CORE_COMPATIBILITY_KEY = "atlas-core-1";

/** The shape of a manifest. Bump when a field is removed or changes meaning. */
export const MODULE_MANIFEST_SCHEMA_VERSION = 1;

export interface ModuleLicenceInfo {
	/** Stable id, the same as the paid database's `licence` table. */
	readonly id: string;
	readonly name: string;
	readonly url: string;
	readonly commercialUse: boolean;
	/** True when anything built from the data must carry the same licence. */
	readonly shareAlike: boolean;
}

/**
 * The licences the sources use. A source whose licence is not here fails
 * `resolveLicences`, so adding a source under a new licence means adding it
 * here and saying whether it allows commercial use and is share-alike.
 */
export const MODULE_LICENCES = [
	{
		id: "ogl-3.0",
		name: "Open Government Licence v3.0",
		url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		commercialUse: true,
		shareAlike: false,
	},
	{
		id: "open-parliament",
		name: "Open Parliament Licence",
		url: "https://www.parliament.uk/site-information/copyright/open-parliament-licence/",
		commercialUse: true,
		shareAlike: false,
	},
	{
		id: "cc-by-sa-3.0",
		name: "Creative Commons Attribution-ShareAlike 3.0",
		url: "https://creativecommons.org/licenses/by-sa/3.0/",
		commercialUse: true,
		shareAlike: true,
	},
] as const satisfies readonly ModuleLicenceInfo[];

export type ModuleLicenceId = (typeof MODULE_LICENCES)[number]["id"];

/** How each licence is written in `meta.json` and in the catalogue. */
const LICENCE_PATTERNS: readonly (readonly [ModuleLicenceId, RegExp])[] = [
	["ogl-3.0", /open government licence|\bogl\b/i],
	["open-parliament", /open parliament licence/i],
	[
		"cc-by-sa-3.0",
		/creative commons attribution[- ]share-?alike 3\.0|\bcc[- ]by-sa 3\.0/i,
	],
];

/**
 * The licences a recorded name stands for. A name can stand for several, as
 * the local elections' "Open Parliament Licence (2021 to 2025); CC BY-SA 3.0
 * (2016 to 2019)" does. A name that matches none gives an empty list.
 */
export const resolveLicences = (name: string): ModuleLicenceId[] =>
	LICENCE_PATTERNS.filter(([, pattern]) => pattern.test(name)).map(
		([id]) => id,
	);

export const getModuleLicence = (id: string): ModuleLicenceInfo | undefined =>
	MODULE_LICENCES.find((licence) => licence.id === id);

export interface ModuleLicenceInput {
	/** The licence names recorded for a registered dataset. */
	readonly datasets: (datasetId: string) => readonly string[];
	/**
	 * The licence names recorded for a foundation part. A part left out has no
	 * licences derived, and its manifest says so with `licences: null`.
	 */
	readonly foundation?: Partial<
		Record<DatasetFoundationPart, readonly string[]>
	>;
}

export interface ModuleManifestDataset {
	readonly id: string;
	readonly title: string;
	readonly topic: DatasetTopic;
	/** Ids from `MODULE_LICENCES`. */
	readonly licences: readonly ModuleLicenceId[];
	/**
	 * True when the module holds only the rows of this dataset under its
	 * licence (a `licensed-rows` split); the rest are in a module it requires.
	 */
	readonly partial: boolean;
}

export interface ModuleManifestTopic {
	readonly id: DatasetTopic;
	readonly label: string;
	readonly description: string;
	readonly theme: DatasetTheme;
}

/**
 * Set when a module holds both share-alike data and data under licences
 * without that term, so it cannot be offered as one unit under one set of
 * terms. The module is still built. No module has one today: task 16 moved the
 * share-alike local elections into `politics-sharealike`. A new share-alike
 * source that lands in a module with other licences raises it again.
 */
export interface ModuleLicenceConflict {
	readonly kind: "share-alike";
	readonly shareAlike: readonly ModuleLicenceId[];
	readonly others: readonly ModuleLicenceId[];
	/** The datasets that carry a share-alike licence. */
	readonly datasets: readonly string[];
}

/** A file of a built module, listed in its manifest. */
export interface ModuleBuildFile {
	/** Relative to the build output, with forward slashes. */
	readonly path: string;
	readonly format: "sqlite" | "parquet";
	readonly bytes: number;
	/** Lower-case hex SHA-256 of the file. */
	readonly sha256: string;
}

/** What the per-module build (task 13) records. */
export type ModuleBuild =
	| {
			readonly status: "not-built";
			readonly bytes: null;
			readonly files: null;
	  }
	| {
			readonly status: "built";
			/** Size of the module's SQLite file in bytes. */
			readonly bytes: number;
			/** Every file in the module with its size and SHA-256. */
			readonly files: readonly ModuleBuildFile[];
			/** Rows per table in the module's SQLite file, by table name. */
			readonly rows: Readonly<Record<string, number>>;
	  };

export interface ModuleManifest {
	readonly schemaVersion: typeof MODULE_MANIFEST_SCHEMA_VERSION;
	readonly id: DatasetModule;
	readonly kind: "theme" | "foundation";
	readonly label: string;
	readonly description: string;
	/** True when every download contains it. */
	readonly alwaysIncluded: boolean;
	readonly themes: readonly DatasetTheme[];
	readonly topics: readonly ModuleManifestTopic[];
	readonly datasets: readonly ModuleManifestDataset[];
	/** Modules a download needs beside core: the module a split adds to. */
	readonly requires: readonly DatasetModule[];
	/** Modules that add rows to this module's datasets, such as a share-alike add-on. */
	readonly addOns: readonly DatasetModule[];
	/** Null when the licences of a foundation part were not derived. */
	readonly licences: readonly ModuleLicenceInfo[] | null;
	readonly licenceConflict: ModuleLicenceConflict | null;
	/** Recorded licence names that match no entry in `MODULE_LICENCES`. */
	readonly unresolvedLicences: readonly string[];
	readonly compatibility: { readonly core: typeof CORE_COMPATIBILITY_KEY };
	readonly build: ModuleBuild;
}

/**
 * The modules that hold datasets of a topic, in module order: the theme's
 * module first when it holds any, then its splits. An add-on that holds rows
 * of a dataset of the topic is included.
 */
export const modulesOfTopic = (topic: DatasetTopic): DatasetModule[] => {
	const held = new Set<DatasetModule>();
	for (const dataset of REGISTERED_DATASETS) {
		if (dataset.topic !== topic) continue;
		held.add(moduleOfDataset(dataset));
		for (const split of DATASET_SPLIT_MODULES)
			if (
				split.holds === "licensed-rows" &&
				split.datasets.includes(dataset.id)
			)
				held.add(split.id);
	}
	return DATASET_MODULE_IDS.filter((id) => held.has(id));
};

const NOT_BUILT: ModuleBuild = {
	status: "not-built",
	bytes: null,
	files: null,
};

/** The manifest with the result of a build recorded in it. */
export const withModuleBuild = (
	manifest: ModuleManifest,
	build: ModuleBuild,
): ModuleManifest => ({ ...manifest, build });

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const licencesOf = (names: readonly string[]) => {
	const ids = unique(names.flatMap(resolveLicences));
	const unresolved = unique(
		names.filter((name) => resolveLicences(name).length === 0),
	);
	return { ids, unresolved };
};

const withLicences = (
	manifest: Omit<
		ModuleManifest,
		"licences" | "licenceConflict" | "unresolvedLicences"
	>,
	ids: readonly ModuleLicenceId[] | null,
	unresolved: readonly string[],
	shareAlikeDatasets: readonly string[],
): ModuleManifest => {
	if (ids === null)
		return {
			...manifest,
			licences: null,
			licenceConflict: null,
			unresolvedLicences: unresolved,
		};
	const held = MODULE_LICENCES.filter(({ id }) => ids.includes(id));
	const shareAlike = held.filter((licence) => licence.shareAlike);
	const others = held.filter((licence) => !licence.shareAlike);
	return {
		...manifest,
		licences: held,
		licenceConflict:
			shareAlike.length > 0 && others.length > 0
				? {
						kind: "share-alike",
						shareAlike: shareAlike.map(({ id }) => id),
						others: others.map(({ id }) => id),
						datasets: shareAlikeDatasets,
					}
				: null,
		unresolvedLicences: unresolved,
	};
};

/**
 * Every module's manifest, theme modules in registry order and then the
 * foundation parts. The same inputs give the same manifests, so a generated
 * README can be compared byte for byte.
 */
export const buildModuleManifests = (
	input: ModuleLicenceInput,
): ModuleManifest[] => {
	const splitById = new Map<string, DatasetSplitModuleInfo>(
		DATASET_SPLIT_MODULES.map((split) => [split.id, split]),
	);
	/** The licence ids a licensed-rows split takes out of the module its datasets stay in. */
	const addOnLicence = (datasetId: string, module: DatasetModule) =>
		DATASET_SPLIT_MODULES.filter(
			(split) =>
				split.holds === "licensed-rows" &&
				split.datasets.includes(datasetId) &&
				split.id !== module,
		).flatMap((split) => (split.licence ? [split.licence] : []));
	const manifestDataset = (
		dataset: (typeof REGISTERED_DATASETS)[number],
		module: DatasetModule,
	): ModuleManifestDataset => {
		const split = splitById.get(module);
		const partial = split?.holds === "licensed-rows";
		const resolved = licencesOf(input.datasets(dataset.id)).ids;
		return {
			id: dataset.id,
			title: dataset.title,
			topic: dataset.topic,
			licences: partial
				? resolved.filter((id) => id === split.licence)
				: resolved.filter(
						(id) => !addOnLicence(dataset.id, module).includes(id),
					),
			partial,
		};
	};
	const themeModules = DATASET_MODULE_IDS.filter(
		(id) => !DATASET_FOUNDATION_PARTS.some((part) => part.id === id),
	);
	const themeManifests = themeModules.flatMap((id) => {
		const split = splitById.get(id);
		const held = REGISTERED_DATASETS.filter((dataset) =>
			split?.holds === "licensed-rows"
				? split.datasets.includes(dataset.id)
				: moduleOfDataset(dataset) === id,
		);
		if (held.length === 0) return [];
		const datasets = held.map((dataset) => manifestDataset(dataset, id));
		const topicIds = [...new Set(datasets.map(({ topic }) => topic))];
		const topics = topicIds.map((topicId): ModuleManifestTopic => {
			const topic = getDatasetTopic(topicId);
			return {
				id: topic.id,
				label: topic.label,
				description: topic.description,
				theme: topic.theme,
			};
		});
		const themes = [...new Set(topics.map(({ theme }) => theme))];
		const owned = DATASET_THEMES.filter((theme) =>
			themes.includes(theme.id),
		);
		const names = held.flatMap(({ id: datasetId }) => {
			const kept = new Set(
				datasets.find((dataset) => dataset.id === datasetId)!.licences,
			);
			return input.datasets(datasetId).filter((name) => {
				const ids = resolveLicences(name);
				return ids.length === 0 || ids.some((id) => kept.has(id));
			});
		});
		const { ids, unresolved } = licencesOf(names);
		const licenceIds = ids.filter((licence) =>
			datasets.some((dataset) => dataset.licences.includes(licence)),
		);
		return [
			withLicences(
				{
					schemaVersion: MODULE_MANIFEST_SCHEMA_VERSION,
					id,
					kind: "theme",
					label:
						split?.label ??
						owned.map((theme) => theme.label).join(", "),
					description:
						split?.description ??
						owned.map((theme) => theme.description).join(" "),
					alwaysIncluded: false,
					themes,
					topics,
					datasets,
					requires: split?.requires ?? [],
					addOns: DATASET_SPLIT_MODULES.filter(
						(other) =>
							other.holds === "licensed-rows" &&
							other.requires.some((required) => required === id),
					).map((other) => other.id),
					compatibility: { core: CORE_COMPATIBILITY_KEY },
					build: NOT_BUILT,
				},
				licenceIds,
				unresolved,
				datasets
					.filter(({ licences }) =>
						licences.some(
							(licence) => getModuleLicence(licence)?.shareAlike,
						),
					)
					.map(({ id: datasetId }) => datasetId),
			),
		];
	});
	const foundationManifests = DATASET_FOUNDATION_PARTS.map((part) => {
		const names = input.foundation?.[part.id];
		const { ids, unresolved } = licencesOf(names ?? []);
		return withLicences(
			{
				schemaVersion: MODULE_MANIFEST_SCHEMA_VERSION,
				id: part.id,
				kind: "foundation",
				label: part.label,
				description: part.description,
				alwaysIncluded: part.alwaysIncluded,
				themes: [],
				topics: [],
				datasets: [],
				requires: [],
				addOns: [],
				compatibility: { core: CORE_COMPATIBILITY_KEY },
				build: NOT_BUILT,
			},
			names === undefined ? null : ids,
			unresolved,
			[],
		);
	});
	return [...themeManifests, ...foundationManifests];
};
