import {
	atlasDatabasePath,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";
import { requirePostcodeAreaLayout } from "./atlasPostcodeAreaShard.ts";
import { readSqlitePostcodeShard } from "./atlasPostcodeShard.ts";
export {
	postcodeFields,
	postcodeDistrictWhere,
	readSqlitePostcodeShard,
} from "./atlasPostcodeShard.ts";
import { readSqlitePostcodeIndexArtifact } from "./atlasPostcodeIndexReader.ts";
import { PostcodeIndex } from "./index.ts";

export const readSqlitePostcodeIndex = (
	repositoryRoot: string,
	databasePath?: string,
): PostcodeIndex => {
	const artifact = readSqlitePostcodeIndexArtifact(
		repositoryRoot,
		databasePath,
	);
	const database = openReadOnlyDatabase(
		databasePath ?? atlasDatabasePath(repositoryRoot),
	);
	let hasPoints: boolean;
	try {
		const columns = database.prepare("PRAGMA table_info(postcodes)").all();
		hasPoints =
			columns.some((column) => column.name === "latitudeMicrodegrees") &&
			columns.some((column) => column.name === "longitudeMicrodegrees");
		if (hasPoints) requirePostcodeAreaLayout(database);
	} finally {
		database.release();
	}
	const entries = new Map(
		artifact.shards.map((entry) => [entry.path, entry]),
	);
	return new PostcodeIndex(artifact, (path) => {
		const entry = entries.get(path);
		if (!entry) throw new Error(`Unknown postcode shard ${path}`);
		if (!hasPoints)
			return readSqlitePostcodeShard(repositoryRoot, entry, databasePath);
		let points: Array<[number, number] | null> = [];
		const text = readSqlitePostcodeShard(
			repositoryRoot,
			entry,
			databasePath,
			(value) => {
				points = value;
			},
		);
		return { text, points };
	});
};
