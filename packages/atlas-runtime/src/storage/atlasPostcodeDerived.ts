export {
	readSqlitePostcodeAreas,
	readSqlitePostcodeAreaShard,
} from "./atlasPostcodeAreaReader";
import { readCachePayload, requireAtlasCache } from "./atlasCache";
import { DatabaseSync } from "node:sqlite";
import type { PostcodeCountsArtifact } from "../postcodes/postcodeCounts";

export function readSqlitePostcodeCounts(
	apiRoot: string,
): PostcodeCountsArtifact {
	const metadata: Omit<PostcodeCountsArtifact, "releases"> & {
		releases: Array<
			Omit<PostcodeCountsArtifact["releases"][number], "areas">
		>;
	} = JSON.parse(
		readCachePayload(apiRoot, "postcode-counts", "postcode-counts"),
	);
	const database = new DatabaseSync(
		requireAtlasCache(apiRoot, "postcode-counts"),
		{ readOnly: true },
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
		database.close();
	}
}
