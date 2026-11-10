import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createBoundaryRegistry } from "../src/geographies/buildBoundaryRegistry.ts";
import { verifiedBoundaryValidity } from "../src/geographies/verifiedBoundaryValidity.ts";

test("verified intervals have valid dates and evidence, and enter the boundary registry", () => {
	const root = mkdtempSync(join(tmpdir(), "validity-"));
	try {
		for (const [key, entries] of Object.entries(verifiedBoundaryValidity)) {
			const [geography, release] = key.split("/") as [string, string];
			const directory = join(
				root,
				"data/source/boundaries",
				geography.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
				release,
			);
			mkdirSync(directory, { recursive: true });
			writeFileSync(
				join(directory, "meta.json"),
				JSON.stringify({
					id: release,
					kind: "boundary",
					title: release,
					publisher: "ONS",
					sourceUrl: "https://example.org",
					licence: { name: "OGL" },
					spatialCoverage: { geography, countries: ["GB-WLS"] },
				}),
			);
			for (const item of entries) {
				for (const date of [item.validFrom, item.validTo])
					expect(
						new Date(`${date}T00:00:00Z`)
							.toISOString()
							.slice(0, 10),
					).toBe(date);
				expect(item.validFrom <= item.validTo).toBe(true);
				expect(new URL(item.sourceUrl).protocol).toBe("https:");
				expect(item.note.length).toBeGreaterThan(0);
			}
		}
		const releases = createBoundaryRegistry(root).releases;
		expect(releases).toHaveLength(
			Object.keys(verifiedBoundaryValidity).length,
		);
		for (const release of releases)
			expect(release.validity).toEqual(
				verifiedBoundaryValidity[`${release.geography}/${release.id}`],
			);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
