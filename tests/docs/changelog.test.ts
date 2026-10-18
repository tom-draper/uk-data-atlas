import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGELOG } from "@/lib/docs/content/changelog";
import { surfaceFingerprint } from "../../services/api/src/apiSurface";

const surfacePath = resolve(
	__dirname,
	"../../services/api/contract/v1-surface.json",
);

describe("API changelog", () => {
	it("has an entry for the locked v1 surface", () => {
		const fingerprint = surfaceFingerprint(
			readFileSync(surfacePath, "utf8"),
		);
		const latest = CHANGELOG.find((entry) => entry.surface);
		expect(
			latest?.surface,
			`The v1 surface changed without a changelog entry. Add one to lib/docs/content/changelog.ts with surface: "${fingerprint}".`,
		).toBe(fingerprint);
	});

	it("lists entries newest first, with real dates", () => {
		const dates = CHANGELOG.map((entry) => entry.date);
		for (const date of dates)
			expect(Number.isNaN(Date.parse(date)), date).toBe(false);
		expect(dates).toEqual([...dates].sort().reverse());
	});
});
