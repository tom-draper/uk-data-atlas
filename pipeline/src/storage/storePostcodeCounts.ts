import { writeCachePart } from "./atlasCacheWriter.ts";
import type { PostcodeCountsArtifact } from "@uk-data-atlas/geography";

export function storePostcodeCounts(
	root: string,
	artifact: PostcodeCountsArtifact,
) {
	const path = writeCachePart(root, {
		component: "postcode-counts",
		write: (database) => {
			database.exec(
				"DROP TABLE IF EXISTS postcode_counts; CREATE TABLE postcode_counts (geography TEXT NOT NULL, boundaryRelease TEXT NOT NULL, code TEXT NOT NULL, live INTEGER NOT NULL, terminated INTEGER NOT NULL, largeUser INTEGER NOT NULL, PRIMARY KEY (geography, boundaryRelease, code)) STRICT, WITHOUT ROWID",
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
				releases: artifact.releases.map(
					({ areas, ...release }) => release,
				),
			};
			database
				.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
				.run("postcode-counts", JSON.stringify(metadata));
		},
	});
	return path;
}
