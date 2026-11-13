import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDatasetTopic, type DatasetTopic } from "@uk-data-atlas/datasets";
import { DATASETS } from "./datasetUniverse";
import {
	DATASET_SOURCES,
	SUPPORT_SOURCES,
	UNUSED_SOURCES,
} from "./sourceDatasets";

/**
 * Checks the table that says which dataset each source folder feeds against
 * the registry and the code that reads sources. It needs no data, so it runs
 * in CI. The folders themselves are checked in
 * tests/built/data/sourceFolders.test.ts.
 */

const known = new Map(DATASETS.map(({ id, topic }) => [id, topic]));
const folders = DATASET_SOURCES.map(([folder]) => folder);

/** Code that names source paths. Loaders are read whole; the rest by file. */
const READERS = [
	"packages/datasets/src/data",
	"pipeline/src/crosswalk-weights/inputs.ts",
	"pipeline/src/sources/fetch-weight-sources.ts",
	"pipeline/src/precompile/roadSafety.ts",
	"pipeline/src/precompile/roadSafetyLoader.ts",
	"pipeline/src/catalog/censusSmallArea.ts",
];

const filesUnder = (path: string): string[] => {
	if (path.endsWith(".ts")) return [path];
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesUnder(join(path, entry.name))
			: entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
				? [join(path, entry.name)]
				: [],
	);
};

const stripComments = (code: string) =>
	code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Every quoted path under a source root, cut at the first `${`. */
const roots = [...new Set(folders.map((folder) => folder.split("/")[0]))];
const literal = new RegExp(
	`["'\`]((?:${roots.join("|")})/[^"'\`]*)["'\`]`,
	"g",
);
const references = READERS.flatMap((reader) =>
	filesUnder(join(process.cwd(), reader)).flatMap((file) =>
		[...stripComments(readFileSync(file, "utf8")).matchAll(literal)].map(
			(match) => match[1].split("${")[0].replace(/\/$/, ""),
		),
	),
);

/** A reference names a folder when one is a path prefix of the other. */
const names = (reference: string, folder: string) =>
	reference === folder ||
	reference.startsWith(`${folder}/`) ||
	folder.startsWith(`${reference}/`);

describe("source folders and datasets", () => {
	it("list each folder once", () => {
		expect(folders.filter((f, i) => folders.indexOf(f) !== i)).toEqual([]);
		const others = [
			...Object.keys(SUPPORT_SOURCES),
			...Object.keys(UNUSED_SOURCES),
		];
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

	it("are read by code, so none is quietly unused", () => {
		const unread = folders.filter(
			(folder) =>
				!references.some((reference) => names(reference, folder)),
		);
		expect(unread).toEqual([]);
	});

	it("are all that code reads under a source root", () => {
		const listed = [
			...folders,
			...Object.keys(SUPPORT_SOURCES),
			...Object.keys(UNUSED_SOURCES),
		];
		const unlisted = [...new Set(references)].filter(
			(reference) => !listed.some((folder) => names(reference, folder)),
		);
		expect(unlisted).toEqual([]);
	});

	it("sit under the theme and topic of the dataset they feed, unless excepted", () => {
		const wrong: string[] = [];
		for (const [folder, datasets, layoutTask] of DATASET_SOURCES) {
			const [segment0, segment1, segment2] = folder.split("/");
			const conforms = datasets.some((id) => {
				const { theme } = getDatasetTopic(
					known.get(id) as DatasetTopic,
				);
				return (
					segment0 === theme &&
					segment1 === known.get(id) &&
					segment2 === id
				);
			});
			if (!conforms && layoutTask === undefined) wrong.push(folder);
			if (conforms && layoutTask !== undefined)
				wrong.push(`${folder} now conforms, drop its task`);
		}
		expect(wrong).toEqual([]);
	});
});
