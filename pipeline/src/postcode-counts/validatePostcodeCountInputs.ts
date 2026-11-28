import { sha256 } from "@uk-data-atlas/artifacts";
import {
	atlasDatabasePath,
	openBuildMetadata,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";
import {
	releaseKey,
	type PostcodeAreasShard,
	type PostcodeShard,
} from "@uk-data-atlas/geography";
import {
	preparePostcodeAreaDistrictReader,
	readSqlitePostcodeIndexArtifact,
	readSqlitePostcodeShard,
	readSqlitePostcodeAreas,
	requirePostcodeAreaLayout,
} from "@uk-data-atlas/places/postcodes";

export function validateShards(root: string) {
	const index = readSqlitePostcodeIndexArtifact(root);
	const areas = readSqlitePostcodeAreas(root);
	if (
		areas.postcodeIndex !== index.contentHash ||
		areas.shards.length !== index.shards.length
	)
		throw new Error("Postcode inventories do not match");
	const path = atlasDatabasePath(root);
	const database = openReadOnlyDatabase(path);
	try {
		requirePostcodeAreaLayout(database);
		const readDistrict = preparePostcodeAreaDistrictReader(
			database,
			areas,
			"postcode",
		);
		const build = openBuildMetadata(path);
		try {
			const readHash = build.prepare(
				"SELECT sha256 FROM postcode_area_shard_hash WHERE district = ?",
			);
			const keys = areas.releases.map(({ geography, boundaryRelease }) =>
				releaseKey(geography, boundaryRelease),
			);
			for (const [at, entry] of index.shards.entries()) {
				const areaEntry = areas.shards[at];
				if (!areaEntry || areaEntry.district !== entry.district)
					throw new Error(`Shard order differs at ${entry.district}`);
				const shard = JSON.parse(
					readSqlitePostcodeShard(root, entry, path),
				) as PostcodeShard;
				const text = readDistrict(entry.district, entry.contentHash);
				if (readHash.get(entry.district)?.sha256 !== sha256(text))
					throw new Error(
						`Invalid SQLite postcode area shard ${areaEntry.path}`,
					);
				const areaShard = JSON.parse(text) as PostcodeAreasShard;
				if (
					areaShard.postcodeShard !== entry.contentHash ||
					areaShard.district !== entry.district ||
					shard.postcodes.length !== entry.postcodes
				)
					throw new Error(`Invalid shard ${entry.district}`);
				for (const key of keys) {
					const column = areaShard.releases[key];
					if (
						!column ||
						column.area.length !== entry.postcodes ||
						column.distanceCm.length !== entry.postcodes
					)
						throw new Error(
							`Invalid column ${key} in ${entry.district}`,
						);
				}
			}
		} finally {
			build.release();
		}
	} finally {
		database.release();
	}
	return { index, areas };
}
