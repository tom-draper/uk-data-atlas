import { type PostcodeAreasArtifact, releaseKey } from "./postcodeAreas";
import type { PostcodeIndexArtifact } from "./postcodeIndexTypes";
import { sha256 } from "./contentHash";

import type {
	PostcodeCounts,
	PostcodeCountsArtifact,
} from "./postcodeCountTypes";
export type {
	PostcodeCounts,
	PostcodeCountsArtifact,
} from "./postcodeCountTypes";

export const postcodeCountsMismatch = (
	artifact: PostcodeCountsArtifact,
	postcodeIndex: PostcodeIndexArtifact,
	postcodeAreas: PostcodeAreasArtifact,
): string | undefined => {
	if (artifact.schemaVersion !== 1 || !Array.isArray(artifact.releases))
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	if (artifact.postcodeIndex !== postcodeIndex.contentHash)
		return "was not compiled from the current postcode index";
	if (artifact.postcodeAreas !== postcodeAreas.contentHash)
		return "was not compiled from the current postcode area index";
	return undefined;
};

/** Compact per-area counts derived from the postcode placements artifact. */
export class PostcodeCountsIndex {
	private readonly releases = new Map<
		string,
		Map<string, Omit<PostcodeCounts, "edition">>
	>();

	constructor(
		readonly artifact: PostcodeCountsArtifact,
		private readonly edition: string,
	) {
		for (const release of artifact.releases)
			this.releases.set(
				releaseKey(release.geography, release.boundaryRelease),
				new Map(Object.entries(release.areas)),
			);
	}

	forArea(
		geography: string,
		boundaryRelease: string,
		code: string,
	): PostcodeCounts | undefined {
		const areas = this.releases.get(releaseKey(geography, boundaryRelease));
		if (!areas) return undefined;
		return {
			...(areas.get(code) ?? { live: 0, terminated: 0, largeUser: 0 }),
			edition: this.edition,
		};
	}
}
