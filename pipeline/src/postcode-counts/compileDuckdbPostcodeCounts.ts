import { releaseKey } from "@uk-data-atlas/geography/postcode-area-types";
import type { PostcodeCountsArtifact } from "@uk-data-atlas/geography/postcode-count-types";
import { sha256 } from "../../../shared/contentHash";
import { aggregateCounts } from "./duckdbPostcodeCounts";
import type { readSqlitePostcodeIndexArtifact } from "../../../shared/atlasPostcodeIndexReader";
import type { readSqlitePostcodeAreas } from "../../../shared/atlasPostcodeAreaReader";

export function compileDuckDBCounts(
	index: ReturnType<typeof readSqlitePostcodeIndexArtifact>,
	areas: ReturnType<typeof readSqlitePostcodeAreas>,
	result: Awaited<ReturnType<typeof aggregateCounts>>,
) {
	const byPosition = new Map(
		result.releases.map(([position, geography, boundary]) => [
			position,
			releaseKey(geography, boundary),
		]),
	);
	const byRelease = new Map<
		string,
		Map<string, { live: number; terminated: number; largeUser: number }>
	>();
	for (const [position, code, live, terminated, largeUser] of result.counts) {
		const key = byPosition.get(position);
		if (!key) throw new Error(`Unknown release ${position}`);
		const release = byRelease.get(key) ?? new Map();
		if (release.has(code))
			throw new Error(`Duplicate count ${key}/${code}`);
		release.set(code, { live, terminated, largeUser });
		byRelease.set(key, release);
	}
	const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
	const releases = areas.releases
		.map(({ geography, boundaryRelease }) => ({
			geography,
			boundaryRelease,
			areas: Object.fromEntries(
				[
					...(byRelease.get(releaseKey(geography, boundaryRelease)) ??
						new Map()),
				].sort(([a], [b]) => compare(a, b)),
			),
		}))
		.sort((a, b) =>
			compare(
				releaseKey(a.geography, a.boundaryRelease),
				releaseKey(b.geography, b.boundaryRelease),
			),
		);
	if (
		result.releases.length !== releases.length ||
		byPosition.size !== releases.length ||
		new Set(byPosition.values()).size !== releases.length ||
		[...byPosition.values()].some(
			(key) =>
				!areas.releases.some(
					(release) =>
						releaseKey(
							release.geography,
							release.boundaryRelease,
						) === key,
				),
		) ||
		byRelease.size > releases.length ||
		result.counts.length === 0
	)
		throw new Error("Count or release inventory differs");
	const body = {
		schemaVersion: 1 as const,
		postcodeIndex: index.contentHash,
		postcodeAreas: areas.contentHash,
		releases,
	};
	const artifact: PostcodeCountsArtifact = {
		...body,
		contentHash: sha256(JSON.stringify(body)),
	};
	return { artifact, releases };
}
