import { createHash } from "node:crypto";
import { closeSync, createReadStream, openSync, readSync } from "node:fs";

/**
 * SHA-256 helpers for the build scripts. All of them return lowercase hex
 * digests. For the `sha256:<hex>` form artifacts record, use `sha256` from
 * `@uk-data-atlas/artifacts`.
 */

/** The hex SHA-256 of a string (hashed as UTF-8) or of bytes. */
export const sha256Hex = (content: string | Uint8Array) =>
	createHash("sha256").update(content).digest("hex");

/** The hex SHA-256 of a file, streamed so a large file is never held whole. */
export async function sha256FileHex(path: string): Promise<string> {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
}

/** The hex SHA-256 of a file, read synchronously a megabyte at a time. */
export function sha256FileHexSync(path: string): string {
	const hash = createHash("sha256");
	const chunk = Buffer.allocUnsafe(1 << 20);
	const descriptor = openSync(path, "r");
	try {
		for (
			let read;
			(read = readSync(descriptor, chunk, 0, chunk.length, null));
		)
			hash.update(chunk.subarray(0, read));
	} finally {
		closeSync(descriptor);
	}
	return hash.digest("hex");
}
