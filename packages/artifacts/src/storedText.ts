import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

/**
 * A published text artifact stored gzipped on disk, as `<path>.gz`.
 *
 * Large JSON lookups (crosswalks, location projections, postcode shards) are
 * read whole by the server, never sent as files, and shrink five to twelve
 * times when gzipped. Each keeps its published name and content hash: only
 * the bytes on disk change, so callers read and write through these helpers
 * with the uncompressed path.
 */

const stored = (path: string) => `${path}.gz`;

/** Whether the artifact exists, gzipped or as plain text. */
export const storedTextExists = (path: string) =>
	existsSync(stored(path)) || existsSync(path);

/** The artifact's text, from the gzipped file, or the plain one before it. */
export const readStoredText = (path: string): string =>
	existsSync(stored(path))
		? gunzipSync(readFileSync(stored(path))).toString("utf8")
		: readFileSync(path, "utf8");

/** Write the artifact gzipped, removing a plain copy an earlier build left. */
export const writeStoredText = (path: string, text: string) => {
	writeFileSync(stored(path), gzipSync(text));
	rmSync(path, { force: true });
};
