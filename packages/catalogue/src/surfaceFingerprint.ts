import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** The short SHA-256 name of a locked API contract, with normalized newlines. */
export const surfaceFingerprint = (text: string): string =>
	bytesToHex(sha256(utf8ToBytes(text.replace(/\r\n/g, "\n")))).slice(0, 12);
