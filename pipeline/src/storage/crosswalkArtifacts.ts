import { join } from "node:path";
import { readStoredText } from "@uk-data-atlas/artifacts";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "@uk-data-atlas/relationships";

/** Room for the largest compiled crosswalk (55 MB of JSON text) and a little over. */
export const CROSSWALK_ARTIFACT_CACHE_BYTES = 64 * 1024 * 1024;

/**
 * Crosswalk artifacts read from the compiled JSON when first asked for, and
 * kept only while the text of those held stays under `maxBytes` (least
 * recently used out first). The whole of a crosswalk is on one file, so a
 * stage that needs every record of a crosswalk reads this faster than it
 * rebuilds the records from `atlas-base.sqlite` (4 seconds against 27 for the
 * 181 in a release), and a stage that needs only a few never parses the rest.
 *
 * `get` returns undefined for an id not in the inventory, or whose artifact
 * names another id, and does not check hashes: callers that validate the
 * artifact compare `contentHash` themselves.
 */
export const createCrosswalkArtifacts = (
	directory: string,
	inventory: CrosswalkInventory,
	maxBytes = CROSSWALK_ARTIFACT_CACHE_BYTES,
) => {
	const entries = new Map(
		inventory.crosswalks.map((entry) => [entry.id, entry]),
	);
	const loaded = new Map<
		string,
		{ artifact: CrosswalkArtifact; bytes: number }
	>();
	let held = 0;
	return {
		get(id: string): CrosswalkArtifact | undefined {
			const cached = loaded.get(id);
			if (cached) {
				// Most recently used last.
				loaded.delete(id);
				loaded.set(id, cached);
				return cached.artifact;
			}
			const entry = entries.get(id);
			if (!entry) return undefined;
			const text = readStoredText(join(directory, entry.artifact));
			const artifact = JSON.parse(text) as CrosswalkArtifact;
			if (artifact.id !== id) return undefined;
			const bytes = Buffer.byteLength(text);
			if (bytes <= maxBytes) {
				while (held + bytes > maxBytes) {
					const oldest = loaded.keys().next().value!;
					held -= loaded.get(oldest)!.bytes;
					loaded.delete(oldest);
				}
				loaded.set(id, { artifact, bytes });
				held += bytes;
			}
			return artifact;
		},
	};
};
