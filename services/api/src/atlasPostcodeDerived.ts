import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inflateSync } from "node:zlib";
import { readAtlasPayload } from "../../../shared/atlasSqlite";
import type { PostcodeAreasArtifact } from "./postcodeAreas";
import type { PostcodeCountsArtifact } from "./postcodeCounts";

export function readSqlitePostcodeAreas(
	apiRoot: string,
): PostcodeAreasArtifact {
	return JSON.parse(
		readAtlasPayload(resolve(apiRoot, "../.."), "postcode-areas"),
	);
}

export function readSqlitePostcodeAreaShard(
	apiRoot: string,
	path: string,
): string {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const row = database
			.prepare("SELECT payload FROM postcode_area_shards WHERE path = ?")
			.get(path);
		if (!(row?.payload instanceof Uint8Array))
			throw new Error(`Missing postcode area shard ${path}`);
		return inflateSync(row.payload).toString("utf8");
	} finally {
		database.close();
	}
}

export function readSqlitePostcodeCounts(
	apiRoot: string,
): PostcodeCountsArtifact {
	const metadata: Omit<PostcodeCountsArtifact, "releases"> & {
		releases: Array<
			Omit<PostcodeCountsArtifact["releases"][number], "areas">
		>;
	} = JSON.parse(
		readAtlasPayload(resolve(apiRoot, "../.."), "postcode-counts"),
	);
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
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
