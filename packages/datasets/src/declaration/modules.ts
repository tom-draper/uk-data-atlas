import {
	DATASET_FOUNDATION_PARTS,
	DATASET_THEMES,
	moduleOfTopic,
	topicsOfTheme,
	type DatasetFoundationPart,
	type DatasetModule,
	type DatasetTheme,
	type DatasetTopic,
} from "./taxonomy.ts";
import { datasetsOfTopic } from "./tree.ts";

/**
 * Module manifests, derived from the registry. A module is a download unit
 * (docs/data-organisation.md, "Modules"): one per theme, plus the foundation
 * parts. The manifest is what the dist tree writes beside each module and
 * what `/v1/modules` serves, so both read `buildModuleManifests` and neither
 * keeps a list of its own. Which topics a module holds is `moduleOfTopic`, so
 * a split such as `population-detail` changes that mapping and nothing here.
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
 * terms. The module is still built; the split is task 16.
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
	/** Null when the licences of a foundation part were not derived. */
	readonly licences: readonly ModuleLicenceInfo[] | null;
	readonly licenceConflict: ModuleLicenceConflict | null;
	/** Recorded licence names that match no entry in `MODULE_LICENCES`. */
	readonly unresolvedLicences: readonly string[];
	readonly compatibility: { readonly core: typeof CORE_COMPATIBILITY_KEY };
	readonly build: ModuleBuild;
}

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
	const byModule = new Map<
		DatasetModule,
		{ themes: DatasetTheme[]; topics: ModuleManifestTopic[] }
	>();
	for (const theme of DATASET_THEMES)
		for (const topic of topicsOfTheme(theme.id)) {
			const id = moduleOfTopic(topic.id);
			const entry = byModule.get(id) ?? { themes: [], topics: [] };
			if (!entry.themes.includes(theme.id)) entry.themes.push(theme.id);
			entry.topics.push({
				id: topic.id,
				label: topic.label,
				description: topic.description,
				theme: theme.id,
			});
			byModule.set(id, entry);
		}
	const themeManifests = [...byModule].map(([id, { themes, topics }]) => {
		const owned = DATASET_THEMES.filter((theme) =>
			themes.includes(theme.id),
		);
		const datasets = topics.flatMap((topic) =>
			datasetsOfTopic(topic.id).map((dataset): ModuleManifestDataset => ({
				id: dataset.id,
				title: dataset.title,
				topic: topic.id,
				licences: licencesOf(input.datasets(dataset.id)).ids,
			})),
		);
		const { ids, unresolved } = licencesOf(
			datasets.flatMap(({ id: datasetId }) => input.datasets(datasetId)),
		);
		return withLicences(
			{
				schemaVersion: MODULE_MANIFEST_SCHEMA_VERSION,
				id,
				kind: "theme",
				label: owned.map((theme) => theme.label).join(", "),
				description: owned.map((theme) => theme.description).join(" "),
				alwaysIncluded: false,
				themes,
				topics,
				datasets,
				compatibility: { core: CORE_COMPATIBILITY_KEY },
				build: NOT_BUILT,
			},
			ids,
			unresolved,
			datasets
				.filter(({ licences }) =>
					licences.some(
						(licence) => getModuleLicence(licence)?.shareAlike,
					),
				)
				.map(({ id: datasetId }) => datasetId),
		);
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
