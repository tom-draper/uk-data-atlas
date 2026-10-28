import { join } from "node:path";
import { readSqlitePostcodeIndexArtifact } from "../../../shared/atlasPostcodeIndexReader";
import { readSqlitePostcodeShard } from "../../../shared/atlasPostcodeShard";
import {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
} from "../../../shared/atlasPostcodeAreaReader";
import {
	releaseKey,
	type PostcodeAreasShard,
} from "../../../shared/postcodeAreaTypes";
import type { PostcodeShard } from "../../../shared/postcodeIndexTypes";

export function validateShards(root: string) {
	const api = join(root, "services/api");
	const index = readSqlitePostcodeIndexArtifact(api);
	const areas = readSqlitePostcodeAreas(api);
	if (
		areas.postcodeIndex !== index.contentHash ||
		areas.shards.length !== index.shards.length
	)
		throw new Error("Postcode inventories do not match");
	for (const [at, entry] of index.shards.entries()) {
		const areaEntry = areas.shards[at];
		if (!areaEntry || areaEntry.district !== entry.district)
			throw new Error(`Shard order differs at ${entry.district}`);
		const shard = JSON.parse(
			readSqlitePostcodeShard(api, entry),
		) as PostcodeShard;
		const areaShard = JSON.parse(
			readSqlitePostcodeAreaShard(api, areaEntry.path),
		) as PostcodeAreasShard;
		if (
			areaShard.postcodeShard !== entry.contentHash ||
			areaShard.district !== entry.district ||
			shard.postcodes.length !== entry.postcodes
		)
			throw new Error(`Invalid shard ${entry.district}`);
		for (const release of areas.releases) {
			const key = releaseKey(release.geography, release.boundaryRelease);
			const column = areaShard.releases[key];
			if (
				!column ||
				column.area.length !== entry.postcodes ||
				column.distanceCm.length !== entry.postcodes
			)
				throw new Error(`Invalid column ${key} in ${entry.district}`);
		}
	}
	return { index, areas };
}
