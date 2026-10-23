import { withCDN } from "./cdn";

/**
 * The containment and lineage lookups, place profiles and docs catalogue are
 * compiled by the API's build. `pnpm data:build --only website-lookups` copies them from its
 * output on disk into public/data, so the website serves and reads its own
 * copy and never needs a running API.
 */
export const ATLAS_LOOKUPS_PATH = "/data/atlas-lookups";
export const ATLAS_PAGES_PATH = "/data/atlas-pages";

const ID = /^[A-Za-z0-9-]+$/;
const checked = (id: string) => {
	if (!ID.test(id)) throw new Error(`Invalid atlas data id ${id}`);
	return id;
};

/** One of the lookups, such as `boundary-mappings`, as the website serves it. */
export const atlasLookupUrl = (id: string) =>
	withCDN(`${ATLAS_LOOKUPS_PATH}/${checked(id)}.json`);

/** One of the pages, such as `places-index`, as the website serves it. */
export const atlasPageUrl = (id: string) =>
	withCDN(`${ATLAS_PAGES_PATH}/${checked(id)}.json`);

/** Fetch a page in the browser. Server code reads it with `readAtlasPage`. */
export async function fetchAtlasPage<T>(id: string): Promise<T> {
	const response = await fetch(atlasPageUrl(id));
	if (!response.ok)
		throw new Error(`Atlas page ${id}: HTTP ${response.status}`);
	return response.json() as Promise<T>;
}
