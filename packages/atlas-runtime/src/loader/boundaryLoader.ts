import { requireAtlasCache } from "@uk-data-atlas/atlas-db";
import { unpackText } from "@uk-data-atlas/atlas-db";
import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
	readSqlitePostcodeCounts,
} from "../postcodes/atlasPostcodeDerived.ts";
import { readGeographyCatalogue } from "../catalogue/geographyCatalogue.ts";
import { readSqliteAreaInventory } from "../areas/atlasAreaReader.ts";
import { existsSync, readFileSync } from "node:fs";
import type { AreaInventory } from "@uk-data-atlas/areas";
import type { GeographyInventory } from "../areas/geographyInventory.ts";
import type { NamedLocationInventory } from "../places/namedLocations.ts";
import {
	openPlaceIndexDatabase,
	type PlaceIndex,
} from "../places/placeIndex.ts";
import {
	openAreaSearchIndexDatabase,
	type AreaSearchIndex,
} from "../areas/areaSearch.ts";
import type { PostcodeIndex } from "@uk-data-atlas/postcodes";
import { readSqlitePostcodeIndex } from "../postcodes/atlasPostcodesReader.ts";
import {
	PostcodeAreaIndex,
	postcodeAreasMismatch,
} from "@uk-data-atlas/postcodes";
import {
	PostcodeCountsIndex,
	postcodeCountsMismatch,
} from "@uk-data-atlas/postcodes";
import type { GeometrySourceLookup } from "@uk-data-atlas/geometry";
import type { TerrainCatalogue } from "@uk-data-atlas/terrain";
import { publicPath } from "@uk-data-atlas/atlas-db";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";

export { readBoundaryRegistry } from "../catalogue/boundaryCatalogue.ts";

export const readGeographyInventory = (
	repositoryRoot: string,
): GeographyInventory =>
	readGeographyCatalogue<GeographyInventory>(
		repositoryRoot,
		"geography-inventory",
		"releases",
		"geography inventory",
	);

export const readTerrainCatalogue = (
	repositoryRoot: string,
): TerrainCatalogue => {
	const path = atlasDatabasePath(repositoryRoot);
	const database = openReadOnlyDatabase(path);
	try {
		const row = database
			.prepare("SELECT payload FROM payloads WHERE id = ?")
			.get("terrain-catalogue");
		const text = unpackText(row?.payload);
		if (text === undefined)
			throw new Error(`Missing terrain catalogue at ${path}`);
		const catalogue = JSON.parse(text) as TerrainCatalogue;
		if (
			catalogue.schemaVersion !== 1 ||
			!Array.isArray(catalogue.products)
		) {
			throw new Error(`Invalid terrain catalogue at ${path}`);
		}
		return catalogue;
	} finally {
		database.release();
	}
};

export const readAreaInventory = readSqliteAreaInventory;

/**
 * The compiled place index, read from its SQLite tables, refused unless built
 * from these very inputs.
 */
export const readPlaceIndex = (
	repositoryRoot: string,
	areaInventory: AreaInventory,
	namedLocations: NamedLocationInventory,
): PlaceIndex => {
	const path = requireAtlasCache(repositoryRoot, "place-index");
	try {
		return openPlaceIndexDatabase(
			path,
			areaInventory.contentHash,
			namedLocations,
		);
	} catch (error) {
		throw new Error(
			`${(error as Error).message} Download the matching atlas data release.`,
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
	repositoryRoot: string,
	postcodeIndex: PostcodeIndex,
	areaInventory: AreaInventory,
	geometrySources: GeometrySourceLookup,
): PostcodeAreaIndex => {
	const path = atlasDatabasePath(repositoryRoot);
	const artifact = readSqlitePostcodeAreas(repositoryRoot);
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
		readSqlitePostcodeAreaShard(repositoryRoot, shard),
	);
};

/** The per-area postcode counts, refused unless built from these indexes. */
export const readPostcodeCounts = (
	repositoryRoot: string,
	postcodeIndex: PostcodeIndex,
	postcodeAreas: PostcodeAreaIndex,
): PostcodeCountsIndex => {
	const path = atlasDatabasePath(repositoryRoot);
	const artifact = readSqlitePostcodeCounts(repositoryRoot);
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
	repositoryRoot: string,
	areaInventory: AreaInventory,
): AreaSearchIndex => {
	const path = requireAtlasCache(repositoryRoot, "area-search");
	try {
		return openAreaSearchIndexDatabase(path, areaInventory.contentHash);
	} catch (error) {
		throw new Error(
			`${(error as Error).message} Download the matching atlas data release.`,
			{ cause: error },
		);
	}
};
