import { sha256 } from "@uk-data-atlas/artifacts";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";

/** Whether a manifest can be served. Undefined when it can. */
export const postcodeIndexMismatch = (
	artifact: PostcodeIndexArtifact,
): string | undefined => {
	if (
		artifact.schemaVersion !== 1 ||
		typeof artifact.source?.edition !== "string" ||
		!Array.isArray(artifact.shards) ||
		!Array.isArray(artifact.excluded)
	)
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	return undefined;
};
