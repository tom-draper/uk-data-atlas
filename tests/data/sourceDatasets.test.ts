import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	getDatasetTopic,
	SOURCES,
	sourceDir,
	sourceTopic,
	type DatasetTopic,
	type SourceName,
} from "@uk-data-atlas/datasets";
import { DATASETS } from "./datasetUniverse";
import { DATASET_SOURCES, SUPPORT_SOURCES } from "./sourceDatasets";

/**
 * Checks the table that says which dataset each source folder feeds against
 * the registry and the code that reads sources. It needs no data, so it runs
 * in CI. The folders themselves are checked in
 * tests/built/data/sourceFolders.test.ts.
 */

const known = new Map(DATASETS.map(({ id, topic }) => [id, topic]));
const folders = DATASET_SOURCES.map(([folder]) => folder);

/** Code that names source folders. Loaders are read whole; the rest by file. */
const READERS = [
	"packages/datasets/src/data",
	"pipeline/src",
	"pipeline/build-data-inputs.mjs",
	"pipeline/build-data-api-stages.mjs",
	"scripts",
	"lib/data",
];

const filesUnder = (path: string): string[] => {
	if (/\.(ts|mts|mjs)$/.test(path)) return [path];
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesUnder(join(path, entry.name))
			: /\.(ts|mts|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)
				? [join(path, entry.name)]
				: [],
	);
};

const stripComments = (code: string) =>
	code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// The migration scripts list the old and the current paths on purpose.
const MIGRATIONS = [
	"scripts/migrate-source-layout.mjs",
	"scripts/migrate-source-meta.mjs",
].map((file) => join(process.cwd(), file));
const code = READERS.flatMap((reader) =>
	filesUnder(join(process.cwd(), reader))
		.filter((file) => !MIGRATIONS.includes(file))
		.map((file) => stripComments(readFileSync(file, "utf8"))),
).join("\n");

/** The folders at the top of `data/source`, now and before the theme layout. */
const OLD_ROOTS = [
	"demographics",
	"deprivation",
	"economics",
	"education",
	"geography",
	"lookups",
	"politics",
	"telecoms",
];

/**
 * Every quoted path that names a source folder: one under an old root, or
 * under a folder of the table. Cut at the first `${`.
 */
const literal = new RegExp(
	`["'\`]((?:${OLD_ROOTS.join("|")})/[^"'\`]*)["'\`]`,
	"g",
);
const quoted = [...code.matchAll(/["'`]([a-z0-9_-]+\/[^"'`]*)["'`]/g)].map(
	(match) => match[1],
);
const hardCoded = [...code.matchAll(literal)].map((match) => match[1]);
/**
 * A path joined in parts, `join(root, "data/source", "lookups", ...)`. Only
 * the boundaries and postcodes roots may be named so; the rest go through
 * `sourceDir`. `transport` is the hand-downloaded OS Open Roads tiles of
 * scripts/serve-os-open-roads.mjs, which are not a source.
 */
const joined = [
	...code.matchAll(/["']data\/source["'],\s*["'`]([^"'`$/]+)["'`]/g),
]
	.map((match) => match[1])
	.filter((root) => !["boundaries", "postcodes", "transport"].includes(root));
/** Config files name a source as the first part of a path, `<name>/<file>`. */
const config = readFileSync(
	join(process.cwd(), "services/api/config/crosswalk-adapters.json"),
	"utf8",
);

const names = Object.keys(SOURCES) as SourceName[];
const listed = new Set([...folders, ...Object.keys(SUPPORT_SOURCES)]);
const named = quoted.filter((path) =>
	[...listed].some(
		(folder) => path === folder || path.startsWith(`${folder}/`),
	),
);

describe("source folders and datasets", () => {
	it("list each folder once", () => {
		expect(folders.filter((f, i) => folders.indexOf(f) !== i)).toEqual([]);
		const others = Object.keys(SUPPORT_SOURCES);
		expect(others.filter((f) => folders.includes(f))).toEqual([]);
		expect(others.filter((f, i) => others.indexOf(f) !== i)).toEqual([]);
	});

	it("name only datasets the registry builds", () => {
		for (const [folder, datasets] of DATASET_SOURCES) {
			expect(datasets.length, folder).toBeGreaterThan(0);
			for (const id of datasets)
				expect(known.has(id), `${folder}: ${id}`).toBe(true);
		}
	});

	it("give every dataset a source folder", () => {
		const fed = new Set(
			DATASET_SOURCES.flatMap(([, datasets]) => datasets),
		);
		expect([...known.keys()].filter((id) => !fed.has(id))).toEqual([]);
	});

	it("are each named by a SOURCES entry, and the reverse", () => {
		const inside = (path: string, folder: string) =>
			path === folder || path.startsWith(`${folder}/`);
		const paths = names.map((name) => sourceDir(name));
		// Sources with no meta.json of their own, so no row in the table.
		const bare = new Set<SourceName>(["lookups", "ceremonial-counties"]);
		expect(
			names.filter(
				(name) =>
					!bare.has(name) &&
					![...listed].some((folder) =>
						inside(folder, sourceDir(name)),
					),
			),
		).toEqual([]);
		expect(
			[...folders, ...Object.keys(SUPPORT_SOURCES)].filter(
				(folder) => !paths.some((path) => inside(folder, path)),
			),
		).toEqual([]);
		expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([]);
	});

	it("are read by code through SOURCES, so none is quietly unused", () => {
		const unread = names.filter(
			(name) =>
				!code.includes(`"${name}"`) &&
				!config.includes(`"${name}/`) &&
				!(
					/^census-2021-ts\d/.test(name) &&
					code.includes("census-2021-${")
				),
		);
		expect(unread).toEqual([]);
	});

	it("are never named by a literal path in code", () => {
		expect([...new Set([...hardCoded, ...named])]).toEqual([]);
		expect(joined).toEqual([]);
	});

	it("file each source under the topic of the datasets it feeds", () => {
		const wrong: string[] = [];
		for (const name of names) {
			const folder = sourceDir(name);
			const topic = sourceTopic(name);
			const source = DATASET_SOURCES.find(([path]) => path === folder);
			if (topic === "core") continue; // Denominators serve many topics.
			if (!source) {
				wrong.push(`${name}: ${topic} but no dataset`);
				continue;
			}
			const topics = source[1].map((id) => known.get(id));
			if (!topics.includes(topic as DatasetTopic))
				wrong.push(
					`${name}: ${topic}, datasets are ${topics.join(", ")}`,
				);
		}
		expect(wrong).toEqual([]);
	});

	it("sit under the theme and topic of the dataset they feed, named for it unless excepted with a reason", () => {
		const wrong: string[] = [];
		for (const [folder, datasets, exception] of DATASET_SOURCES) {
			const [theme, topic, name] = folder.split("/");
			if (theme === "core") continue; // Denominators serve many topics.
			const under = datasets.some(
				(id) =>
					theme ===
						getDatasetTopic(known.get(id) as DatasetTopic).theme &&
					topic === known.get(id),
			);
			if (!under)
				wrong.push(`${folder} is not under its theme and topic`);
			const named = datasets.includes(name);
			if (!named && exception === undefined)
				wrong.push(`${folder} is not named after a dataset`);
			if (named && exception !== undefined)
				wrong.push(
					`${folder} is named after a dataset, drop its exception`,
				);
		}
		expect(wrong).toEqual([]);
	});

	it("keep foundation sources in core/", () => {
		expect(
			Object.keys(SUPPORT_SOURCES).filter(
				(folder) => !folder.startsWith("core/"),
			),
		).toEqual([]);
	});
});
