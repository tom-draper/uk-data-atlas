import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";

/**
 * Small compiled files for the datasets whose API catalogue measures are read
 * from their declaration. Each lists the two authorities its dataset covers.
 */
const file = (boundaryYear: number, data: Record<string, unknown>) => ({
	"2025": {
		year: 2025,
		boundaryYear,
		boundaryType: "localAuthority",
		data,
	},
});

export const INDICATOR_FIXTURES: Record<string, unknown> = {
	waste: file(2025, {
		E06000001: { value: 42.5 },
		E06000002: { value: 7 },
	}),
	"planning-applications": file(2025, {
		E06000001: { value: 120 },
		E06000002: { value: 33 },
	}),
};

/** The authorities the fixtures expect, one of which the files lack. */
export const FIXTURE_ENGLAND_2025 = ["E06000001", "E06000002", "E06000003"];

/** Writes each fixture to a temporary directory and removes it afterwards. */
export function withFixtureFiles<T>(
	run: (paths: Record<string, string>, manifest: CatalogManifest) => T,
): T {
	const directory = mkdtempSync(join(tmpdir(), "indicator-fixtures-"));
	try {
		const paths: Record<string, string> = {};
		for (const [id, content] of Object.entries(INDICATOR_FIXTURES)) {
			paths[id] = join(directory, `${id}.json`);
			writeFileSync(paths[id], JSON.stringify(content));
		}
		const manifest = {
			manifestPath: join(directory, "dataset-manifest.json"),
			datasets: Object.keys(INDICATOR_FIXTURES).map((id) => ({
				id,
				summary: { boundaryYears: [2025] },
			})),
		} as CatalogManifest;
		return run(paths, manifest);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
