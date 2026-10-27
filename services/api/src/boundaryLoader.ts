import { requireAtlasCache } from "./atlasCache";
import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
	readSqlitePostcodeCounts,
} from "./atlasPostcodeDerived";
import { readGeographyCatalogue } from "./geographyCatalogue";
import { readSqliteAreaInventory } from "./atlasAreas";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AreaInventory } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { GeographyInventory } from "./geographyInventory";
import type { NamedLocationInventory } from "./namedLocations";
import { openPlaceIndexDatabase, type PlaceIndex } from "./placeIndex";
import {
	openAreaSearchIndexDatabase,
	type AreaSearchIndex,
} from "./areaSearch";
import type { PostcodeIndex } from "./postcodes";
import { readSqlitePostcodeIndex } from "./atlasPostcodes";
import { PostcodeAreaIndex, postcodeAreasMismatch } from "./postcodeAreas";
import { PostcodeCountsIndex, postcodeCountsMismatch } from "./postcodeCounts";
import type { GeometrySourceLookup } from "./areaGeometry";
import type { TerrainCatalogue } from "./terrainCatalogue";
import { publicPath } from "./publicManifest";

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry =>
	readGeographyCatalogue<BoundaryRegistry>(
		apiRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);

export const readGeographyInventory = (apiRoot: string): GeographyInventory =>
	readGeographyCatalogue<GeographyInventory>(
		apiRoot,
		"geography-inventory",
		"releases",
		"geography inventory",
	);

export const readTerrainCatalogue = (apiRoot: string): TerrainCatalogue => {
	const path = resolve(apiRoot, "../../data/build/atlas.sqlite");
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

export {
	DEFAULT_AREA_CACHE_RECORDS,
	readAreaLookup,
} from "../../../shared/areaLookup";

/**
 * The compiled place index, read from its SQLite tables, refused unless built
 * from these very inputs.
 */
export const readPlaceIndex = (
	apiRoot: string,
	areaInventory: AreaInventory,
	namedLocations: NamedLocationInventory,
): PlaceIndex => {
	const path = requireAtlasCache(apiRoot, "place-index");
	try {
		return openPlaceIndexDatabase(
			path,
			areaInventory.contentHash,
			namedLocations,
		);
	} catch (error) {
		throw new Error(
			`${(error as Error).message} Run pnpm --dir services/api build:cache from the repository root.`,
			{ cause: error },
		);
	}
};

/** The compiled postcode index and district records, read from atlas.sqlite. */
export const readPostcodeIndex = readSqlitePostcodeIndex;

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
	const path = resolve(apiRoot, "../../data/build/atlas.sqlite");
	const artifact = readSqlitePostcodeAreas(apiRoot);
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
			`The postcode area index at ${path} ${mismatch}. Run pnpm --dir ../.. data:build --only postcode-areas.`,
		);
	}
	return new PostcodeAreaIndex(artifact, postcodeIndex, (shard) =>
		readSqlitePostcodeAreaShard(apiRoot, shard),
	);
};

/** The per-area postcode counts, refused unless built from these indexes. */
export const readPostcodeCounts = (
	apiRoot: string,
	postcodeIndex: PostcodeIndex,
	postcodeAreas: PostcodeAreaIndex,
): PostcodeCountsIndex => {
	const path = resolve(apiRoot, "../../data/build/atlas.sqlite");
	const artifact = readSqlitePostcodeCounts(apiRoot);
	const mismatch = postcodeCountsMismatch(
		artifact,
		postcodeIndex.artifact,
		postcodeAreas.artifact,
	);
	if (mismatch)
		throw new Error(
			`The postcode counts at ${path} ${mismatch}. Run pnpm --dir ../.. data:build --only postcode-counts.`,
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
	const path = requireAtlasCache(apiRoot, "area-search");
	try {
		return openAreaSearchIndexDatabase(path, areaInventory.contentHash);
	} catch (error) {
		throw new Error(
			`${(error as Error).message} Run pnpm --dir services/api build:cache from the repository root.`,
			{ cause: error },
		);
	}
};
