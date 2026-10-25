import { publishAtlasCache } from "../src/atlasCache";
import { copyFileSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { writePostcodeAreas } from "../src/atlasPostcodeAreas";
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
			database.exec("PRAGMA foreign_keys = ON; BEGIN");
			write(database);
			database.exec("COMMIT");
			if (id === "postcode-areas") database.exec("VACUUM");
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
		writePostcodeAreas(database, artifact, readShard);
		database
			.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
			.run("postcode-areas", JSON.stringify(artifact));
	});
}

export function storePostcodeCounts(
	root: string,
	artifact: PostcodeCountsArtifact,
) {
	const path = publishAtlasCache(root, "postcode-counts", (database) => {
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
	const publicRoot = join(root, "services/api/public");
	for (const suffix of [".json", ".json.gz"])
		rmSync(join(publicRoot, `postcode-counts${suffix}`), { force: true });
	return path;
}
