import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";

/**
 * Small compiled files for the datasets whose API catalogue measures are read
 * from their declaration. Each leaves an authority without a value, so the
 * coverage note is exercised, and income carries the county and region rows
 * the table interleaves with its authorities.
 */
const file = (boundaryYear: number, data: Record<string, unknown>) => ({
	[String(boundaryYear)]: {
		year: boundaryYear,
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
	"air-quality": file(2024, {
		E06000001: {
			gridCells: 24,
			no2Mean: 11.5,
			pm10Mean: 13.25,
			pm25Mean: 7.75,
			pm25PopulationWeighted: 8.5,
			pm25PopulationWeightedAnthropogenic: 5.5,
		},
		E06000002: {
			gridCells: 9,
			no2Mean: 14,
			pm10Mean: 12,
			pm25Mean: 8,
			pm25PopulationWeighted: 9,
			pm25PopulationWeightedAnthropogenic: 6,
		},
	}),
	homelessness: file(2025, {
		E06000001: {
			householdsInTemporaryAccommodation: 62,
			householdsWithChildren: 30,
			childrenInTemporaryAccommodation: 54,
		},
		E06000002: {
			householdsInTemporaryAccommodation: 11,
			householdsWithChildren: 4,
			childrenInTemporaryAccommodation: 9,
		},
	}),
	income: file(2025, {
		E06000001: {
			annual: { median: 31250 },
			hourly: { median: 15.8 },
		},
		E06000002: { annual: { median: null }, hourly: { median: 14.2 } },
		E10000003: { annual: { median: 29000 }, hourly: { median: 14 } },
		E12000001: { annual: { median: 30000 }, hourly: { median: 14.5 } },
	}),
	"workplace-income": file(2025, {
		E06000001: { annual: { median: 28000 }, hourly: { median: 13.9 } },
		E06000002: { annual: { median: 27100 }, hourly: { median: null } },
		E10000003: { annual: { median: 29000 }, hourly: { median: 14 } },
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
			datasets: Object.entries(INDICATOR_FIXTURES).map(
				([id, content]) => ({
					id,
					summary: {
						boundaryYears: Object.values(
							content as Record<string, { boundaryYear: number }>,
						).map(({ boundaryYear }) => boundaryYear),
					},
				}),
			),
		} as CatalogManifest;
		return run(paths, manifest);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
