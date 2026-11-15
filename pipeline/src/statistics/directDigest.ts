import { sha256Hex } from "../lib/hash.ts";

/**
 * What stands for a direct-only dataset's compiled file: the hash and size of
 * its parts as serialised, in the order they were read.
 */
export const directDigest = (parts: readonly unknown[]) => {
	const text = JSON.stringify(parts);
	return { sha256: sha256Hex(text), bytes: Buffer.byteLength(text, "utf8") };
};
