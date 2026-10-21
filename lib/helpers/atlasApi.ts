/** Where the public API is served. The docs show it in their examples. */
export const PUBLIC_API_ORIGIN = "https://api.ukdataatlas.com";

/**
 * The API the atlas reads from. Set `NEXT_PUBLIC_ATLAS_API_ORIGIN` to point a
 * local build at a local API.
 */
export const ATLAS_API_ORIGIN =
	process.env.NEXT_PUBLIC_ATLAS_API_ORIGIN || PUBLIC_API_ORIGIN;

/** One of the containment and lineage lookups the API compiles for the atlas. */
export const atlasLookupUrl = (id: string) =>
	`${ATLAS_API_ORIGIN}/v1/atlas-lookups/${id}.json`;

/** Website artifacts retain Next.js prerendering and refresh daily. */
export async function fetchAtlasPage<T>(id: string): Promise<T> {
	const response = await fetch(
		`${ATLAS_API_ORIGIN}/v1/atlas-pages/${encodeURIComponent(id)}.json`,
		{ next: { revalidate: 86400 } },
	);
	if (!response.ok)
		throw new Error(`Atlas page ${id}: HTTP ${response.status}`);
	return response.json() as Promise<T>;
}
