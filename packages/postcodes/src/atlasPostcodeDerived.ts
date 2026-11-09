export {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
} from "./atlasPostcodeAreaReader.ts";
import { readCachePayload, requireAtlasCache } from "@uk-data-atlas/atlas-db";
import type { PostcodeCountsArtifact } from "./index.ts";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";

export function readSqlitePostcodeCounts(
	repositoryRoot: string,
): PostcodeCountsArtifact {
	const metadata: Omit<PostcodeCountsArtifact, "releases"> & {
		releases: Array<
			Omit<PostcodeCountsArtifact["releases"][number], "areas">
		>;
	} = JSON.parse(
		readCachePayload(repositoryRoot, "postcode-counts", "postcode-counts"),
	);
	const database = openReadOnlyDatabase(
		requireAtlasCache(repositoryRoot, "postcode-counts"),
	);
	try {
		const select = database.prepare(
			"SELECT code, live, terminated, largeUser FROM postcode_counts WHERE geography = ? AND boundaryRelease = ? ORDER BY code",
		);
		return {
			...metadata,
			releases: metadata.releases.map((release) => ({
				...release,
				areas: Object.fromEntries(
					select
						.all(release.geography, release.boundaryRelease)
						.map((row) => [
							String(row.code),
							{
								live: Number(row.live),
								terminated: Number(row.terminated),
								largeUser: Number(row.largeUser),
							},
						]),
				),
			})),
		};
	} finally {
		database.release();
	}
}
