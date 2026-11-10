import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

/**
 * `series` holds converted series beside the published ones. A query that
 * reads it without saying which it wants would hand a converted figure to a
 * reader that takes everything for published, so every query names the
 * method, or is listed here with why it reads them all.
 */

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Files whose queries read every series on purpose, and how many do. */
const READS_EVERY_SERIES: Readonly<
	Record<string, { queries: number; reason: string }>
> = {
	"pipeline/src/ids/databaseKeys.ts": {
		queries: 1,
		reason: "Every series has a stable id, whatever its method.",
	},
	"pipeline/src/storage/statisticsTables.ts": {
		queries: 2,
		reason: "A check that holds for every series, and v_observation, which returns the method of each row.",
	},
	"services/api/scripts/benchmark-sqlite-pragmas.ts": {
		queries: 1,
		reason: "Times a scan of the whole table and returns no figure.",
	},
};

const SOURCE_ROOTS = [
	"packages",
	"pipeline/src",
	"services",
	"scripts",
	"app",
	"lib",
	"components",
];
const SKIPPED = new Set(["node_modules", "dist", "tests", "built", ".vite"]);

const sourceFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (SKIPPED.has(entry.name)) return [];
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(ts|mts|tsx|mjs|js)$/.test(entry.name) &&
			!/\.test\./.test(entry.name)
			? [path]
			: [];
	});

/** The queries of a file that read `series` without naming a method. */
const unfiltered = (text: string) => {
	const found: string[] = [];
	for (const match of text.matchAll(
		/\b(?:FROM|JOIN)\s+series\b(?![_.])(?:\s+(?:AS\s+)?(?!WHERE\b|JOIN\b|ON\b|ORDER\b|LEFT\b)(\w+))?/g,
	)) {
		// To the end of the string the query is written in.
		const rest = text.slice(match.index, match.index + 2500);
		const query = rest.slice(
			0,
			Math.max(0, rest.search(/[`"]/)) || rest.length,
		);
		const method = match[1] ? `${match[1]}.method` : "method";
		if (!query.includes(method)) found.push(match[0]);
	}
	return found;
};

test("finds a query that reads series without naming a method", () => {
	assert.deepEqual(
		unfiltered("`SELECT s.id FROM series s WHERE s.dataset_id = ?`"),
		["FROM series s"],
	);
	assert.deepEqual(
		unfiltered(
			"`SELECT 1 FROM observation o JOIN series s ON s.method = 'published' AND s.id = o.series_id`",
		),
		[],
	);
	assert.deepEqual(unfiltered('"SELECT id FROM series WHERE id = ?"'), [
		"FROM series",
	]);
	assert.deepEqual(unfiltered("`SELECT 1 FROM series_member sm`"), []);
});

test("every query that reads series names the method it wants", () => {
	const seen = new Map<string, number>();
	const offending: string[] = [];
	for (const directory of SOURCE_ROOTS)
		for (const path of sourceFiles(join(root, directory))) {
			const name = relative(root, path);
			const found = unfiltered(readFileSync(path, "utf8"));
			if (found.length === 0) continue;
			seen.set(name, found.length);
			if (found.length !== READS_EVERY_SERIES[name]?.queries)
				offending.push(`${name}: ${found.join(", ")}`);
		}
	assert.deepEqual(offending, []);
	// An entry nothing needs any more must go.
	assert.deepEqual(
		Object.keys(READS_EVERY_SERIES).filter((name) => !seen.has(name)),
		[],
	);
});
