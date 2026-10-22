import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATLAS_PAGES_PATH } from "./atlasData";

const reads = new Map<string, Promise<unknown>>();

/**
 * A page from the website's own copy in public/data, read once per server
 * instance. A failed read is not remembered, so a later request retries.
 */
export function readAtlasPage<T>(id: string): Promise<T> {
	if (!/^[A-Za-z0-9-]+$/.test(id))
		return Promise.reject(new Error(`Invalid atlas page id ${id}`));
	let read = reads.get(id);
	if (!read) {
		const path = join(
			process.cwd(),
			"public",
			ATLAS_PAGES_PATH,
			`${id}.json`,
		);
		read = readFile(path, "utf8").then(JSON.parse, (error: unknown) => {
			reads.delete(id);
			throw new Error(
				`Atlas page ${id} is missing. Run pnpm atlas-data:copy after the API build.`,
				{ cause: error },
			);
		});
		reads.set(id, read);
	}
	return read as Promise<T>;
}
