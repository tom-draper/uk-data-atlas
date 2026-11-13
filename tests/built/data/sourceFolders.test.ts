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
 * Every meta.json under the root is validated against the schema, boundaries,
 * lookups and postcodes included, and its kind and dataset must agree with
 * where the folder sits and with the table.
 */

const ROOT = join(process.cwd(), "data/source");
const STAGING = "_staging";

/** The kind a folder must declare, by where it sits. */
const KIND_ROOTS: readonly (readonly [root: string, kind: string])[] = [
	["boundaries/", "boundary"],
	["core/lookups/", "lookup"],
	["postcodes/", "postcode-directory"],
	[`${STAGING}/`, "staged"],
];

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

const readMeta = (folder: string) =>
	parseDatasetMeta(
		JSON.parse(readFileSync(join(ROOT, folder, "meta.json"), "utf8")),
		folder.split("/").at(-1)!,
	);

describe.skipIf(!existsSync(ROOT))("source folders", () => {
	const all = sourceFolders(ROOT).map((path) => relative(ROOT, path));
	const found = all.filter(
		(folder) => !KIND_ROOTS.some(([root]) => `${folder}/`.startsWith(root)),
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
		for (const folder of all) {
			const dir = join(ROOT, folder);
			expect(statSync(dir).isDirectory()).toBe(true);
			const meta = JSON.parse(
				readFileSync(join(dir, "meta.json"), "utf8"),
			);
			expect(
				() => parseDatasetMeta(meta, folder.split("/").at(-1)!),
				folder,
			).not.toThrow();
		}
	});

	it("name a dataset the table says they feed, the one they are named for", () => {
		for (const [folder, datasets] of DATASET_SOURCES) {
			const meta = readMeta(folder);
			expect(meta.kind, folder).toBe("dataset");
			expect(datasets, folder).toContain(meta.dataset);
			const named = datasets.find((id) => folder.split("/").includes(id));
			if (named) expect(meta.dataset, folder).toBe(named);
		}
	});

	it("name no dataset when they feed none", () => {
		for (const folder of all) {
			const root = KIND_ROOTS.find(([prefix]) =>
				`${folder}/`.startsWith(prefix),
			);
			const meta = readMeta(folder);
			if (root) expect(meta.kind, folder).toBe(root[1]);
			else if (folder in SUPPORT_SOURCES)
				expect(meta.kind, folder).toBe("support");
			else continue;
			expect(meta.dataset, folder).toBeUndefined();
		}
	});

	it("keep unlisted sources in _staging/, where nothing reads them", () => {
		const staged = found.filter((folder) =>
			folder.startsWith(`${STAGING}/`),
		);
		expect(staged.filter((folder) => listed.has(folder))).toEqual([]);
	});
});
