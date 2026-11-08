import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { IdRegistry, type RegistryFile } from "./idRegistry.ts";

/**
 * Where a registry's text is kept: `<directory>/<name>.txt` if it is one
 * file, else every `.txt` under `<directory>/<name>/`, which are written once
 * and never changed.
 */

const SAFE_GROUP =
	/^[A-Za-z0-9][A-Za-z0-9._+-]*(\/[A-Za-z0-9][A-Za-z0-9._+-]*)*$/;

const files = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) =>
			entry.isDirectory()
				? files(join(directory, entry.name))
				: entry.name.endsWith(".txt")
					? [join(directory, entry.name)]
					: [],
		)
		.sort();

export type LoadedRegistry = {
	registry: IdRegistry;
	/** What was read, to find a change made while the registry was in use. */
	read: { path: string; text: string }[];
	written: { path: string; text: string }[];
};

/** The path of a registry as one file, or its directory if segmented. */
export const registryPath = (
	directory: string,
	name: string,
	segmented: boolean,
) => join(directory, segmented ? name : `${name}.txt`);

export const loadRegistry = (
	directory: string,
	name: string,
	options: {
		first: number;
		fields: number;
		segmented: boolean;
		frozen: boolean;
	},
): LoadedRegistry => {
	const path = registryPath(directory, name, options.segmented);
	const read: LoadedRegistry["read"] = [];
	if (options.segmented) {
		if (existsSync(path))
			for (const file of files(path))
				read.push({ path: file, text: readFileSync(file, "utf8") });
	} else if (existsSync(path))
		read.push({ path, text: readFileSync(path, "utf8") });
	const registry = new IdRegistry(name, {
		...options,
		files: read.map(({ path: file, text }) => ({
			name: relative(directory, file),
			text,
		})),
	});
	return { registry, read, written: [] };
};

/**
 * Write what a registry added. One that is a file is appended to; a
 * segmented one gets a new file for each group, named after it (and, if that
 * is taken, after the first id it holds), and no file that is there is
 * touched. Refuses if the files are not the ones that were loaded, since
 * another build has added ids this one cannot know.
 */
export const saveRegistry = (
	directory: string,
	loaded: LoadedRegistry,
): string[] => {
	const { registry } = loaded;
	const pending = registry.pending();
	const path = registryPath(directory, registry.name, registry.segmented);
	const known = [...loaded.read, ...loaded.written];
	const changed = () =>
		new Error(
			`Id registry ${relative(directory, path)} changed while it was in use. Rebuild so no ids are lost.`,
		);
	const created: string[] = [];
	if (!registry.segmented) {
		const text = known.map((file) => file.text).join("");
		const body = pending.map((item) => item.text).join("");
		if (body === "" && existsSync(path)) return created;
		if (
			existsSync(path) ? readFileSync(path, "utf8") !== text : text !== ""
		)
			throw changed();
		const header = text === "" ? registry.header() : "";
		mkdirSync(dirname(path), { recursive: true });
		appendFileSync(path, header + body);
		loaded.written.push({ path, text: header + body });
		registry.markSaved();
		return [path];
	}
	const present = existsSync(path) ? files(path) : [];
	if (
		present.length !== known.length ||
		!present.every((file) => known.some((item) => item.path === file))
	)
		throw changed();
	for (const { group, text } of pending) {
		if (!SAFE_GROUP.test(group))
			throw new Error(
				`Id registry ${registry.name} cannot name a file ${JSON.stringify(group)}`,
			);
		let file = join(path, `${group}.txt`);
		if (existsSync(file)) {
			const first = Number(/^=(\d+)$/m.exec(text)![1]);
			file = join(path, `${group}+${first}.txt`);
		}
		const content = registry.header(relative(path, file)) + text;
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, content, { flag: "wx" });
		loaded.written.push({ path: file, text: content });
		created.push(file);
	}
	registry.markSaved();
	return created;
};

export type { RegistryFile };
