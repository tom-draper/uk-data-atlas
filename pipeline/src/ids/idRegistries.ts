import { join } from "node:path";
import { IdRegistry } from "./idRegistry.ts";
import {
	loadRegistry,
	registryPath,
	saveRegistry,
	type LoadedRegistry,
} from "./idStore.ts";

/**
 * Every id the database assigns, and the natural key each is assigned to.
 * `fields` is the key's length and `first` its first id: release positions
 * and crosswalk ids have always started at 0, the others at 1. The two
 * registries too big to be one reviewable file are `segmented`: a directory
 * of files, each written once, so a new release adds a file.
 */
export const ID_NAMESPACES = {
	/** `(geography, release id)`: `area_releases.position`, the `release_id` columns. */
	release: { first: 0, fields: 2, segmented: false },
	/** `(slug)`: `geography.id`. */
	geography: { first: 1, fields: 1, segmented: false },
	/** `(geography, code)`: `area.id`. */
	area: { first: 1, fields: 2, segmented: true },
	/** `(geography, release id, code)`: `area_version.id`. */
	area_version: { first: 1, fields: 3, segmented: true },
	/** `(slug)`: `crosswalk.id`. */
	crosswalk: { first: 0, fields: 1, segmented: false },
	/** `(publisher, url, licence)` as JSON: `source.id`. */
	source: { first: 1, fields: 1, segmented: false },
	/** `(slug)`: `dataset.id`. */
	dataset: { first: 1, fields: 1, segmented: false },
	/** `(slug)`: `measure.id`. */
	measure: { first: 1, fields: 1, segmented: false },
	/** `(slug)`: `dimension.id`. */
	dimension: { first: 1, fields: 1, segmented: false },
	/** `(dimension slug, code)`: `dimension_member.id`. */
	dimension_member: { first: 1, fields: 2, segmented: false },
	/** `(label)`: `period.id`. */
	period: { first: 1, fields: 1, segmented: false },
	/** `(series key)`: `series.id`. */
	series: { first: 1, fields: 1, segmented: false },
	/** `(dataset slug, label)`: `election.id`. */
	election: { first: 1, fields: 2, segmented: false },
	/** `(party code)`: `party.id`. */
	party: { first: 1, fields: 1, segmented: false },
	/** `(dataset slug, election label, geography, release id, code)`: `contest.id`. */
	contest: { first: 1, fields: 5, segmented: false },
} as const;

export type IdNamespace = keyof typeof ID_NAMESPACES;

export const idNamespaces = Object.keys(ID_NAMESPACES) as IdNamespace[];

/** Where the committed registries live, relative to the repository root. */
export const ID_DIRECTORY = "pipeline/ids";

export const idDirectory = (root: string) => join(root, ID_DIRECTORY);

/**
 * The committed registries of a repository. `ATLAS_IDS_FROZEN=1` makes the
 * build refuse any key they lack, for a build that must not change them.
 */
export const loadIdRegistries = (
	root: string,
	environment: NodeJS.ProcessEnv = process.env,
) =>
	IdRegistries.load(idDirectory(root), {
		frozen: environment.ATLAS_IDS_FROZEN === "1",
	});

/** The file, or for a segmented registry the directory, of a namespace. */
export const idRegistryPath = (directory: string, name: IdNamespace) =>
	registryPath(
		directory,
		name.replaceAll("_", "-"),
		ID_NAMESPACES[name].segmented,
	);

/**
 * The registries of one build. `memory()` starts every namespace empty and
 * saves nothing, which numbers keys in the order they are met, as a fresh
 * database always was. `load()` reads the committed registries, so keys met
 * before keep their ids, and `save()` appends the keys met for the first time.
 */
export class IdRegistries {
	readonly registries: Record<IdNamespace, IdRegistry>;
	readonly directory: string | undefined;
	private readonly loaded: Record<IdNamespace, LoadedRegistry> | undefined;

	private constructor(
		loaded: Record<IdNamespace, LoadedRegistry>,
		directory?: string,
	) {
		this.loaded = directory === undefined ? undefined : loaded;
		this.registries = Object.fromEntries(
			idNamespaces.map((name) => [name, loaded[name].registry]),
		) as Record<IdNamespace, IdRegistry>;
		this.directory = directory;
	}

	static memory() {
		return new IdRegistries(
			IdRegistries.create(() => ({ registry: undefined })),
		);
	}

	/**
	 * `frozen` refuses to assign: for a build that must not change the
	 * committed registries, so a new key fails instead of taking an id nobody
	 * commits.
	 */
	static load(directory: string, { frozen = false } = {}) {
		return new IdRegistries(
			IdRegistries.create((name) =>
				loadRegistry(directory, name.replaceAll("_", "-"), {
					...ID_NAMESPACES[name],
					frozen,
				}),
			),
			directory,
		);
	}

	private static create(
		load: (name: IdNamespace) => LoadedRegistry | { registry: undefined },
	) {
		return Object.fromEntries(
			idNamespaces.map((name) => {
				const loaded = load(name);
				return [
					name,
					loaded.registry
						? loaded
						: {
								registry: new IdRegistry(name, {
									...ID_NAMESPACES[name],
								}),
								read: [],
								written: [],
							},
				];
			}),
		) as Record<IdNamespace, LoadedRegistry>;
	}

	get release() {
		return this.registries.release;
	}
	get geography() {
		return this.registries.geography;
	}
	get area() {
		return this.registries.area;
	}
	get areaVersion() {
		return this.registries.area_version;
	}
	get crosswalk() {
		return this.registries.crosswalk;
	}
	get source() {
		return this.registries.source;
	}
	get dataset() {
		return this.registries.dataset;
	}
	get measure() {
		return this.registries.measure;
	}
	get dimension() {
		return this.registries.dimension;
	}
	get dimensionMember() {
		return this.registries.dimension_member;
	}
	get period() {
		return this.registries.period;
	}
	get series() {
		return this.registries.series;
	}
	get election() {
		return this.registries.election;
	}
	get party() {
		return this.registries.party;
	}
	get contest() {
		return this.registries.contest;
	}

	/** Whether any registry holds an id. */
	get empty() {
		return idNamespaces.every((name) => this.registries[name].size === 0);
	}

	/** The number of ids added since loading, by namespace. */
	get added() {
		return Object.fromEntries(
			idNamespaces.map((name) => [name, this.registries[name].added]),
		) as Record<IdNamespace, number>;
	}

	/**
	 * Write what was added to the committed files: appended to a small
	 * registry, new files for a segmented one. A no-op for `memory()`.
	 * Returns the files created or extended.
	 */
	save() {
		if (this.directory === undefined || this.loaded === undefined)
			return [];
		return idNamespaces.flatMap((name) =>
			saveRegistry(this.directory!, this.loaded![name]),
		);
	}
}
