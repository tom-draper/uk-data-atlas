import { readSqliteAreaInventory, readSqliteAreas } from "./atlasAreas";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	type AreaRecord,
	type AreaInventory,
	type AreaLookup,
} from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";
import type { NamedLocationInventory } from "./namedLocations";
import {
	openPlaceIndexDatabase,
	PLACE_INDEX_DATABASE,
	type PlaceIndex,
} from "./placeIndex";
import {
	AREA_SEARCH_INDEX_DATABASE,
	openAreaSearchIndexDatabase,
	type AreaSearchIndex,
} from "./areaSearch";
import {
	PostcodeIndex,
	postcodeIndexMismatch,
	type PostcodeIndexArtifact,
} from "./postcodes";
import {
	PostcodeAreaIndex,
	postcodeAreasMismatch,
	type PostcodeAreasArtifact,
} from "./postcodeAreas";
import {
	PostcodeCountsIndex,
	postcodeCountsMismatch,
	type PostcodeCountsArtifact,
} from "./postcodeCounts";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { TerrainCatalogue } from "./terrainCatalogue";
import { publicPath, readPublicManifest } from "./publicManifest";
import { readStoredText } from "./storedText";

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry =>
	readPublicManifest<BoundaryRegistry>(
		apiRoot,
		"boundary-releases.json",
		"releases",
		"boundary registry",
	);

export const readGeographyInventory = (apiRoot: string): GeographyInventory =>
	readPublicManifest<GeographyInventory>(
		apiRoot,
		"geography-inventory.json",
		"releases",
		"geography inventory",
	);

export const readTerrainCatalogue = (apiRoot: string): TerrainCatalogue => {
	const path = resolve(apiRoot, "../../compiled/atlas.sqlite");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const row = database
			.prepare("SELECT payload FROM payloads WHERE id = ?")
			.get("terrain-catalogue") as { payload: string } | undefined;
		if (!row) throw new Error(`Missing terrain catalogue at ${path}`);
		const catalogue = JSON.parse(row.payload) as TerrainCatalogue;
		if (
			catalogue.schemaVersion !== 1 ||
			!Array.isArray(catalogue.products)
		) {
			throw new Error(`Invalid terrain catalogue at ${path}`);
		}
		return catalogue;
	} finally {
		database.close();
	}
};

export const readAreaInventory = readSqliteAreaInventory;

/**
 * Area records kept parsed at once, about 125 bytes each. Every release
 * compiled today, about 574,000 records, fits. Some routes read every
 * release of a geography in one request, so a budget smaller than a
 * geography's releases would re-read files on each such request.
 */
export const DEFAULT_AREA_CACHE_RECORDS = 1_000_000;

class LazyAreaLookup extends Map<string, Map<string, AreaRecord>> {
	private readonly loaded = new Map<string, Map<string, AreaRecord>>();
	private readonly releases: Map<string, AreaInventory["releases"][number]>;
	private loadedRecords = 0;

	constructor(
		private readonly apiRoot: string,
		inventory: AreaInventory,
		private readonly maxRecords: number,
	) {
		super();
		this.releases = new Map(
			inventory.releases.flatMap((release) => {
				if (release.status !== "available") return [];
				const key = `${release.geography}/${release.id}`;
				super.set(key, new Map());
				return [[key, release]];
			}),
		);
	}

	override get(key: string) {
		const cached = this.loaded.get(key);
		if (cached) {
			this.loaded.delete(key);
			this.loaded.set(key, cached);
			return cached;
		}
		const release = this.releases.get(key);
		if (!release || release.status !== "available") return undefined;
		const areas = new Map(
			readSqliteAreas(this.apiRoot, release).map((area) => [
				area.code,
				area,
			]),
		);
		this.loaded.set(key, areas);
		this.loadedRecords += areas.size;
		// Evict least recently used releases, but always keep the one just read.
		for (const [oldest, records] of this.loaded) {
			if (this.loadedRecords <= this.maxRecords || oldest === key) break;
			this.loaded.delete(oldest);
			this.loadedRecords -= records.size;
		}
		return areas;
	}

	override *entries(): MapIterator<[string, Map<string, AreaRecord>]> {
		for (const key of this.keys()) yield [key, this.get(key)!];
	}

	override *values(): MapIterator<Map<string, AreaRecord>> {
		for (const key of this.keys()) yield this.get(key)!;
	}

	override [Symbol.iterator]() {
		return this.entries();
	}

	override forEach(
		callback: (
			value: Map<string, AreaRecord>,
			key: string,
			map: Map<string, Map<string, AreaRecord>>,
		) => void,
		thisArg?: unknown,
	) {
		for (const [key, value] of this)
			callback.call(thisArg, value, key, this);
	}
}

export const readAreaLookup = (
	apiRoot: string,
	inventory = readAreaInventory(apiRoot),
	maxRecords = DEFAULT_AREA_CACHE_RECORDS,
): AreaLookup => new LazyAreaLookup(apiRoot, inventory, maxRecords);

/**
 * The compiled place index, read from its SQLite tables, refused unless built
 * from these very inputs.
 */
export const readPlaceIndex = (
	apiRoot: string,
	areaInventory: AreaInventory,
	namedLocations: NamedLocationInventory,
): PlaceIndex => {
	try {
		return openPlaceIndexDatabase(
			publicPath(apiRoot, PLACE_INDEX_DATABASE),
			areaInventory.contentHash,
			namedLocations,
		);
	} catch (error) {
		throw new Error(
			`${(error as Error).message} Run pnpm build:place-index.`,
			{ cause: error },
		);
	}
};

/**
 * The compiled postcode index. Only its manifest is read here; each area's
 * shard is read, and checked against the manifest, on first use.
 */
export const readPostcodeIndex = (apiRoot: string): PostcodeIndex => {
	const path = publicPath(apiRoot, "postcode-index.json");
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeIndexArtifact;
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch) {
		throw new Error(
			`The postcode index at ${path} ${mismatch}. Run pnpm build:postcode-index.`,
		);
	}
	return new PostcodeIndex(artifact, (shard) =>
		readStoredText(publicPath(apiRoot, shard)),
	);
};

/**
 * The compiled postcode area index, refused unless built from this postcode
 * index and the current areas and geometry of every release it holds.
 */
export const readPostcodeAreaIndex = (
	apiRoot: string,
	postcodeIndex: PostcodeIndex,
	areaInventory: AreaInventory,
	geometrySources: GeometrySourceLookup,
): PostcodeAreaIndex => {
	const path = publicPath(apiRoot, "postcode-areas.json");
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeAreasArtifact;
	const mismatch = postcodeAreasMismatch(artifact, postcodeIndex.artifact, {
		areaRelease: (geography, boundaryRelease) => {
			const release = areaInventory.releases.find(
				(entry) =>
					entry.geography === geography &&
					entry.id === boundaryRelease,
			);
			return release?.status === "available"
				? release.contentHash
				: undefined;
		},
		geometryInput: (geography, boundaryRelease) =>
			geometrySources.get(`${geography}/${boundaryRelease}`)?.inputHash,
	});
	if (mismatch) {
		throw new Error(
			`The postcode area index at ${path} ${mismatch}. Run pnpm build:postcode-areas.`,
		);
	}
	return new PostcodeAreaIndex(artifact, postcodeIndex, (shard) =>
		readStoredText(publicPath(apiRoot, shard)),
	);
};

/** The per-area postcode counts, refused unless built from these indexes. */
export const readPostcodeCounts = (
	apiRoot: string,
	postcodeIndex: PostcodeIndex,
	postcodeAreas: PostcodeAreaIndex,
): PostcodeCountsIndex => {
	const path = publicPath(apiRoot, "postcode-counts.json");
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeCountsArtifact;
	const mismatch = postcodeCountsMismatch(
		artifact,
		postcodeIndex.artifact,
		postcodeAreas.artifact,
	);
	if (mismatch)
		throw new Error(
			`The postcode counts at ${path} ${mismatch}. Run pnpm build:postcode-counts.`,
		);
	return new PostcodeCountsIndex(
		artifact,
		postcodeIndex.artifact.source.edition,
	);
};

/**
 * The compiled area search index, read from its SQLite tables, refused unless
 * built from this inventory.
 */
export const readAreaSearchIndex = (
	apiRoot: string,
	areaInventory: AreaInventory,
): AreaSearchIndex => {
	try {
		return openAreaSearchIndexDatabase(
			publicPath(apiRoot, AREA_SEARCH_INDEX_DATABASE),
			areaInventory.contentHash,
		);
	} catch (error) {
		throw new Error(
			`${(error as Error).message} Run pnpm build:area-search-index.`,
			{ cause: error },
		);
	}
};
