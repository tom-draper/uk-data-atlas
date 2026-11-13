import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDatasetMeta } from "@uk-data-atlas/datasets";
import { DATASET_SOURCES, SUPPORT_SOURCES } from "../../data/sourceDatasets";

/**
 * Checks `data/source` against the table in tests/data/sourceDatasets.ts
 * (docs/data-organisation.md, task 3). Needs the raw sources, which are not in
 * git, so it skips when they are absent. The offline half of the check, table
 * against registry and code, runs in tests/data/sourceDatasets.test.ts.
 *
 * Boundaries, core/lookups and postcodes have their own tests and are skipped
 * here.
 */

const ROOT = join(process.cwd(), "data/source");
const OWN_TESTS = ["boundaries/", "core/lookups/", "postcodes/"];
const STAGING = "_staging";

/**
 * Two folders that were both `2016` under `referendum/` share a parent now, so
 * they carry the name of their dataset, while the release still holds the id
 * they had. The ids change when the release is next published (task 6).
 */
const RELEASE_IDS: Readonly<Record<string, string>> = {
	"politics/referendums/constituencies-2016": "2016",
	"politics/referendums/local-authorities-2016": "2016",
};

const listed = new Set([
	...DATASET_SOURCES.map(([folder]) => folder),
	...Object.keys(SUPPORT_SOURCES),
]);

/** Folders holding a meta.json, relative to the source root. */
const sourceFolders = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (!entry.isDirectory() || entry.name.startsWith(".")) return [];
		const path = join(dir, entry.name);
		const own = existsSync(join(path, "meta.json")) ? [path] : [];
		return [...own, ...sourceFolders(path)];
	});

describe.skipIf(!existsSync(ROOT))("source folders", () => {
	const found = sourceFolders(ROOT)
		.map((path) => relative(ROOT, path))
		.filter(
			(folder) =>
				!OWN_TESTS.some((root) => `${folder}/`.startsWith(root)),
		);

	it("are each listed, so a new source says what it is for", () => {
		expect(found.length).toBeGreaterThan(50);
		expect(
			found.filter(
				(folder) =>
					!listed.has(folder) && !folder.startsWith(`${STAGING}/`),
			),
		).toEqual([]);
	});

	it("exist for every listed source", () => {
		expect([...listed].filter((folder) => !found.includes(folder))).toEqual(
			[],
		);
	});

	it("carry a valid meta.json named after the folder", () => {
		for (const folder of found) {
			const dir = join(ROOT, folder);
			expect(statSync(dir).isDirectory()).toBe(true);
			const meta = JSON.parse(
				readFileSync(join(dir, "meta.json"), "utf8"),
			);
			expect(
				() =>
					parseDatasetMeta(
						meta,
						RELEASE_IDS[folder] ?? folder.split("/").at(-1)!,
					),
				folder,
			).not.toThrow();
		}
	});

	it("keep unlisted sources in _staging/, where nothing reads them", () => {
		const staged = found.filter((folder) =>
			folder.startsWith(`${STAGING}/`),
		);
		expect(staged.filter((folder) => listed.has(folder))).toEqual([]);
	});
});
