import { rmSync } from "node:fs";
import { join } from "node:path";
import { publishAtlasCache } from "../storage/atlasCache";
import type { PostcodeCountsArtifact } from "@uk-data-atlas/geography/postcode-count-types";
import { artifactDirectory } from "../storage/dataLayout";

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
	const publicRoot = artifactDirectory(root);
	for (const suffix of [".json", ".json.gz"])
		rmSync(join(publicRoot, `postcode-counts${suffix}`), { force: true });
	return path;
}
