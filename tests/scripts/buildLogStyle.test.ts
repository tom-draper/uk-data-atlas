import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * Build stages print through `buildLog` (packages/atlas-db/src/
 * buildTiming.ts), so every stage shares one style. This fails when a file in
 * these directories calls `console.log`, `console.info` or `console.warn`.
 * `console.error` stays for uncaught failures.
 */
const ROOT = process.cwd();
const DIRECTORIES = [
	"pipeline/src",
	"scripts",
	"services/api/scripts",
	...readdirSync(join(ROOT, "packages")).map(
		(name) => `packages/${name}/src`,
	),
];

/** The logger itself prints to the console. */
const LOGGER = ["packages/atlas-db/src/buildTiming.ts"];

/**
 * Stages that PR #542 (retire legacy observation tables) is changing. Move
 * each to `buildLog` once it merges, then delete its entry.
 */
const AWAITING_OBSERVATION_TABLES_PR = [
	"pipeline/src/stages/assemble-atlas.ts",
	"pipeline/src/stages/build-data-catalog.ts",
	"pipeline/src/stages/build-export-manifest.ts",
	"pipeline/src/stages/build-measure-compatibility.ts",
	"pipeline/src/stages/build-statistics-read-path.ts",
	"pipeline/src/stages/build-validation-report.ts",
];

/**
 * Interactive tools and one-off scripts that no build stage runs. They print
 * for a person at a terminal, so they keep their own output.
 */
const STANDALONE_TOOLS = [
	"pipeline/src/stages/verify-map-downloads.ts",
	"scripts/boundaries.js",
	"scripts/gazetteer-phase0.ts",
	"scripts/migrate-source-layout.mjs",
	"scripts/migrate-source-meta.mjs",
	"scripts/reproject-datazone-boundary.mts",
	"scripts/simplify-boundary-source.mts",
	"services/api/scripts/audit-archive.mjs",
	"services/api/scripts/smoke.ts",
	"services/api/scripts/usage-report.ts",
];

/** Benchmark, profile, compare, proposal and verify scripts. */
const STANDALONE_FAMILIES =
	/(?:^|\/)(?:benchmark|profile|compare|propose|verify)-[^/]+$/;

const CONSOLE_CALL = /\bconsole\.(?:log|info|warn)\b/;

const sourceFiles = (directory: string): string[] => {
	let names: string[];
	try {
		names = readdirSync(join(ROOT, directory));
	} catch {
		return [];
	}
	return names.flatMap((name) => {
		const path = `${directory}/${name}`;
		if (name === "node_modules") return [];
		if (statSync(join(ROOT, path)).isDirectory()) return sourceFiles(path);
		return /\.(?:[cm]?[jt]s|tsx)$/.test(name) ? [path] : [];
	});
};

const withoutComments = (source: string) =>
	source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const callsConsole = (file: string) =>
	CONSOLE_CALL.test(withoutComments(readFileSync(join(ROOT, file), "utf8")));

const exempt = new Set([
	...LOGGER,
	...AWAITING_OBSERVATION_TABLES_PR,
	...STANDALONE_TOOLS,
]);

test("build stages print through the build log, not console.log, info or warn", () => {
	const offenders = DIRECTORIES.flatMap(sourceFiles)
		.filter((file) => !exempt.has(file))
		.filter((file) => !STANDALONE_FAMILIES.test(file))
		.filter(callsConsole);
	expect(offenders).toEqual([]);
});

test("every exemption still needs its entry", () => {
	const stale = [
		...AWAITING_OBSERVATION_TABLES_PR,
		...STANDALONE_TOOLS,
		...LOGGER,
	].filter((file) => !callsConsole(file));
	expect(stale).toEqual([]);
});
