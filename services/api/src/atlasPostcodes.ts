import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "../../../shared/atlasSqlite";
import { sha256 } from "./contentHash";
import {
	PostcodeIndex,
	postcodeIndexMismatch,
	type PostcodeIndexArtifact,
	type PostcodeShard,
} from "./postcodes";
import type { SqliteTable } from "./sqliteIndex";

export const postcodeTables = (
	artifact: PostcodeIndexArtifact,
	readShard: (path: string) => string,
): Record<string, SqliteTable> => {
	function* rows() {
		for (const entry of artifact.shards) {
			const text = readShard(entry.path);
			if (sha256(text) !== entry.contentHash)
				throw new Error(`Invalid postcode shard ${entry.path}`);
			const shard: PostcodeShard = JSON.parse(text);
			if (
				shard.schemaVersion !== 1 ||
				shard.district !== entry.district ||
				shard.postcodes.length !== entry.postcodes ||
				shard.grid.length !== entry.postcodes * 2 ||
				[
					shard.quality,
					shard.country,
					shard.introduced,
					shard.terminated,
					shard.largeUser,
				].some((column) => column.length !== entry.postcodes)
			)
				throw new Error(`Invalid postcode district ${entry.district}`);
			for (const [position, postcode] of shard.postcodes.entries())
				yield [
					entry.district,
					position,
					postcode,
					shard.grid[position * 2]!,
					shard.grid[position * 2 + 1]!,
					shard.quality[position]!,
					shard.country[position]!,
					shard.introduced[position]!,
					shard.terminated[position]!,
					shard.largeUser[position]!,
				];
		}
	}
	return {
		postcodes: {
			columns: [
				"district TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"postcode TEXT NOT NULL UNIQUE",
				"easting INTEGER",
				"northing INTEGER",
				"quality TEXT NOT NULL",
				"country TEXT NOT NULL",
				"introduced INTEGER NOT NULL",
				"terminated INTEGER NOT NULL",
				"largeUser TEXT NOT NULL",
			],
			key: ["district", "position"],
			rows: rows(),
		},
	};
};

/** Reconstruct the compiler's exact shard bytes while retaining positional joins. */
export const readSqlitePostcodeShard = (
	apiRoot: string,
	entry: PostcodeIndexArtifact["shards"][number],
): string => {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const rows = database
			.prepare(
				"SELECT * FROM postcodes WHERE district = ? ORDER BY position",
			)
			.all(entry.district);
		const shard: PostcodeShard = {
			schemaVersion: 1,
			district: entry.district,
			postcodes: rows.map((row) => String(row.postcode)),
			grid: rows.flatMap((row) => [
				row.easting === null ? null : Number(row.easting),
				row.northing === null ? null : Number(row.northing),
			]),
			quality: rows.map((row) => String(row.quality)).join(""),
			country: rows.map((row) => String(row.country)).join(""),
			introduced: rows.map((row) => Number(row.introduced)),
			terminated: rows.map((row) => Number(row.terminated)),
			largeUser: rows.map((row) => String(row.largeUser)).join(""),
		};
		const text = `${JSON.stringify(shard)}\n`;
		if (
			rows.length !== entry.postcodes ||
			sha256(text) !== entry.contentHash
		)
			throw new Error(
				`Invalid SQLite postcode district ${entry.district}`,
			);
		return text;
	} finally {
		database.close();
	}
};

export const readSqlitePostcodeIndex = (apiRoot: string): PostcodeIndex => {
	const artifact: PostcodeIndexArtifact = JSON.parse(
		readAtlasPayload(resolve(apiRoot, "../.."), "postcode-index"),
	);
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch)
		throw new Error(
			`The SQLite postcode index ${mismatch}. Run pnpm data:build --only postcode-index.`,
		);
	const entries = new Map(
		artifact.shards.map((entry) => [entry.path, entry]),
	);
	return new PostcodeIndex(artifact, (path) => {
		const entry = entries.get(path);
		if (!entry) throw new Error(`Unknown postcode shard ${path}`);
		return readSqlitePostcodeShard(apiRoot, entry);
	});
};
