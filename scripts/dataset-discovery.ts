/**
 * Finds every dataset in `data/` by looking for `meta.json`. A dataset's id is
 * its folder path relative to `data/`, so dropping a well-formed folder in is
 * all that is needed for the build to see it.
 */
import { readdir, readFile } from "fs/promises";
import { basename, join, relative, sep } from "path";
import { parseDatasetMeta, type DatasetMeta } from "../lib/data/catalog/meta";

export interface DiscoveredDataset {
	/** Folder path relative to `data/`, e.g. "elections/local-elections/2025". */
	id: string;
	/** Absolute path to the dataset folder. */
	dir: string;
	meta: DatasetMeta;
}

// Compiled output and served copies are not source datasets.
const SKIP_DIRECTORIES = new Set(["precompiled", "node_modules"]);

async function* walk(dir: string): AsyncGenerator<string> {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) {
			continue;
		}
		const child = join(dir, entry.name);
		yield child;
		yield* walk(child);
	}
}

/**
 * Reads every dataset under `root`, in path order. Throws on the first invalid
 * `meta.json` so a malformed drop fails the build rather than vanishing.
 */
export async function discoverDatasets(
	root: string,
): Promise<DiscoveredDataset[]> {
	const found: DiscoveredDataset[] = [];

	for await (const dir of walk(root)) {
		let raw: string;
		try {
			raw = await readFile(join(dir, "meta.json"), "utf8");
		} catch {
			continue; // A grouping folder, not a dataset.
		}

		const id = relative(root, dir).split(sep).join("/");
		let json: unknown;
		try {
			json = JSON.parse(raw);
		} catch (error) {
			throw new Error(
				`${id}/meta.json is not valid JSON: ${(error as Error).message}`,
			);
		}
		found.push({ id, dir, meta: parseDatasetMeta(json, basename(dir)) });
	}

	return found.sort((a, b) => a.id.localeCompare(b.id));
}
