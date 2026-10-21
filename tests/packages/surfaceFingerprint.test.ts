import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { surfaceFingerprint } from "@uk-data-atlas/catalogue/surface-fingerprint";

describe("browser-safe contract fingerprint", () => {
	it.each(["", "hello", "a\r\nb", "Welsh: Cymru, 日本語"])(
		"matches the existing SHA-256 fingerprint for %j",
		(text) => {
			expect(surfaceFingerprint(text)).toBe(
				createHash("sha256")
					.update(text.replace(/\r\n/g, "\n"))
					.digest("hex")
					.slice(0, 12),
			);
		},
	);
});
