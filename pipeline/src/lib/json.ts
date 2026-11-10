import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * Reads and parses a UTF-8 JSON file. The type is the caller's claim, not a
 * check, so a script that needs the shape validated still does so. Read and
 * parse errors are the platform's own.
 */
export const readJsonSync = <T = unknown>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

/** `readJsonSync` without blocking the event loop. */
export const readJson = async <T = unknown>(path: string): Promise<T> =>
	JSON.parse(await readFile(path, "utf8")) as T;
