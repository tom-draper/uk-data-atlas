import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { sha256FileHexSync } from "./lib/hash.ts";

type Entry = { size: number; mtimeNs: string; ino: number; hash: string };

/** A file's sha256, read a chunk at a time rather than held whole. */
export const hashFile = (path: string) => `sha256:${sha256FileHexSync(path)}`;

/**
 * File hashes kept between builds, so gigabytes of unchanged boundary
 * sources are not read again each time. A file is hashed afresh whenever its
 * size, modification time or inode differ from when it was last hashed, as
 * they do for any file a data download writes.
 */
export const createFileHashCache = (cachePath: string) => {
	let entries: Record<string, Entry> = {};
	try {
		entries = JSON.parse(readFileSync(cachePath, "utf8"));
	} catch {
		// No cache yet, or an unreadable one: every file is hashed.
	}
	const used: Record<string, Entry> = {};
	return {
		hash(path: string) {
			const stat = statSync(path, { bigint: true });
			const current = {
				size: Number(stat.size),
				mtimeNs: stat.mtimeNs.toString(),
				ino: Number(stat.ino),
			};
			const known = used[path] ?? entries[path];
			const entry =
				known &&
				known.size === current.size &&
				known.mtimeNs === current.mtimeNs &&
				known.ino === current.ino
					? known
					: { ...current, hash: hashFile(path) };
			used[path] = entry;
			return entry.hash;
		},
		/** Keeps only the files hashed this run, so removed ones drop out. */
		save() {
			if (!existsSync(dirname(cachePath)))
				mkdirSync(dirname(cachePath), { recursive: true });
			writeFileSync(cachePath, `${JSON.stringify(used)}\n`);
		},
	};
};
