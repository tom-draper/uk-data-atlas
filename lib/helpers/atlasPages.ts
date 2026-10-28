import { readAtlasAssetText } from "@uk-data-atlas/atlas-runtime/storage";

const reads = new Map<string, Promise<unknown>>();

/**
 * A page from the shared database, read once per server
 * instance. A failed read is not remembered, so a later request retries.
 */
export function readAtlasPage<T>(id: string): Promise<T> {
	if (!/^[A-Za-z0-9-]+$/.test(id))
		return Promise.reject(new Error(`Invalid atlas page id ${id}`));
	let read = reads.get(id);
	if (!read) {
		read = Promise.resolve()
			.then(() => readAtlasAssetText(process.cwd(), "pages", id))
			.then(JSON.parse)
			.catch((error: unknown) => {
				reads.delete(id);
				throw error;
			});
		reads.set(id, read);
	}
	return read as Promise<T>;
}
