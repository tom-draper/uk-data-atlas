import { copyFileSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { deflateSync } from "node:zlib";
import { sha256 } from "../src/contentHash";
import type { PostcodeAreasArtifact } from "../src/postcodeAreas";
import type { PostcodeCountsArtifact } from "../src/postcodeCounts";

/** Publish complete tables atomically, preserving the other atlas data. */
function store(
	root: string,
	id: string,
	write: (database: DatabaseSync) => void,
) {
	const path = join(root, "data/build/atlas.sqlite");
	const temporary = `${path}.${id}.${randomUUID()}.tmp`;
	try {
		copyFileSync(path, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec("BEGIN");
			write(database);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	const publicRoot = join(root, "services/api/public");
	rmSync(join(publicRoot, id), { recursive: true, force: true });
	for (const suffix of [".json", ".json.gz"])
		rmSync(join(publicRoot, `${id}${suffix}`), { force: true });
	return path;
}

export function storePostcodeAreas(
	root: string,
	artifact: PostcodeAreasArtifact,
	readShard: (path: string) => string,
) {
	return store(root, "postcode-areas", (database) => {
		database.exec(
			"DROP TABLE IF EXISTS postcode_area_shards; CREATE TABLE postcode_area_shards (path TEXT PRIMARY KEY, payload BLOB NOT NULL) WITHOUT ROWID",
		);
		const insert = database.prepare(
			"INSERT INTO postcode_area_shards VALUES (?, ?)",
		);
		for (const entry of artifact.shards) {
			const text = readShard(entry.path);
			if (sha256(text) !== entry.contentHash)
				throw new Error(`Invalid postcode area shard ${entry.path}`);
			insert.run(entry.path, deflateSync(text));
		}
		database
			.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
			.run("postcode-areas", JSON.stringify(artifact));
	});
}

export function storePostcodeCounts(
	root: string,
	artifact: PostcodeCountsArtifact,
) {
	return store(root, "postcode-counts", (database) => {
		database.exec(
			"DROP TABLE IF EXISTS postcode_counts; CREATE TABLE postcode_counts (geography TEXT NOT NULL, boundaryRelease TEXT NOT NULL, code TEXT NOT NULL, live INTEGER NOT NULL, terminated INTEGER NOT NULL, largeUser INTEGER NOT NULL, PRIMARY KEY (geography, boundaryRelease, code)) WITHOUT ROWID",
		);
		const insert = database.prepare(
			"INSERT INTO postcode_counts VALUES (?, ?, ?, ?, ?, ?)",
		);
		for (const release of artifact.releases)
			for (const [code, counts] of Object.entries(release.areas))
				insert.run(
					release.geography,
					release.boundaryRelease,
					code,
					counts.live,
					counts.terminated,
					counts.largeUser,
				);
		const metadata = {
			...artifact,
			releases: artifact.releases.map(({ areas, ...release }) => release),
		};
		database
			.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
			.run("postcode-counts", JSON.stringify(metadata));
	});
}
