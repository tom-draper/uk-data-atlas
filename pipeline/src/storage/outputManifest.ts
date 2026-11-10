import { appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sha256Hex } from "../lib/hash.ts";

/**
 * The data build sets this to a file for each stage it runs. A stage that
 * hashes a file while it writes it appends the hash there, and the build then
 * trusts it for a file that still has the stat it had when the hash was
 * recorded, instead of reading the file back. Run on its own, a stage has no
 * manifest and these functions only write.
 */
export const OUTPUT_MANIFEST_ENV = "DATA_BUILD_OUTPUT_MANIFEST";

/**
 * Notes the SHA-256 of a finished file. Call it after the file is in its final
 * place, with a hash of the bytes written, never of a read-back. A file changed
 * afterwards no longer matches the stat noted here and is hashed again.
 */
export function recordOutputHash(
	path: string,
	sha256: string,
	manifest: string | undefined = process.env[OUTPUT_MANIFEST_ENV],
) {
	if (!manifest) return;
	const { size, mtimeMs, ino } = statSync(path);
	mkdirSync(dirname(manifest), { recursive: true });
	appendFileSync(
		manifest,
		`${JSON.stringify({ path: resolve(path), size, mtimeMs, ino, sha256 })}\n`,
	);
}

/** Writes a file and notes the hash of its content for the build. */
export function writeFileHashedSync(
	path: string,
	content: string | Uint8Array,
	manifest?: string,
) {
	writeFileSync(path, content);
	recordOutputHash(path, sha256Hex(content), manifest);
}
