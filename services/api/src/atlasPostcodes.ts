import { readSqlitePostcodeShard } from "../../../shared/atlasPostcodeShard";
export {
	postcodeFields,
	postcodeDistrictWhere,
	readSqlitePostcodeShard,
} from "../../../shared/atlasPostcodeShard";
import { resolve } from "node:path";
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
				"postcode TEXT NOT NULL",
				"easting INTEGER",
				"northing INTEGER",
				"quality TEXT NOT NULL",
				"country TEXT NOT NULL",
				"introduced INTEGER NOT NULL",
				"terminated INTEGER NOT NULL",
				"largeUser TEXT NOT NULL",
			],
			key: ["postcode"],
			rows: rows(),
		},
	};
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
