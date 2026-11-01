import { API_BASE_URL, API_ORIGIN } from "@/lib/site";
import type {
	AreaHistory,
	BoundaryRelease,
	BulkLookup,
	ConvertedCounts,
	Crosswalk,
	ExactValidation,
	InferredValidation,
	ReleaseRef,
} from "./types";

/**
 * The fix page's calls to the public API, made from the browser. Values go
 * in POST bodies, so area codes do not end up in URLs or access logs, except
 * for history, which the API only serves one code at a time.
 */

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${API_BASE_URL}${path}`, init);
	} catch (error) {
		if ((error as Error).name === "AbortError") throw error;
		throw new ApiError(
			"Couldn't reach the UK Data Atlas API. Check your connection and try again.",
			0,
		);
	}
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const problem = body as { title?: string; detail?: string } | null;
		throw new ApiError(
			problem?.detail ??
				problem?.title ??
				`The API answered ${response.status}.`,
			response.status,
		);
	}
	return (body as { data: T }).data;
}

const query = (ref?: ReleaseRef) =>
	ref
		? `?${new URLSearchParams({ geography: ref.geography, release: ref.boundaryRelease })}`
		: "";

export interface ValidateBody {
	values: string[];
	parents?: string[];
}

export function validateInferred(
	body: ValidateBody,
	signal?: AbortSignal,
): Promise<InferredValidation> {
	return request("/areas:validate", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
		signal,
	});
}

export function validateAgainst(
	release: ReleaseRef,
	body: ValidateBody,
	signal?: AbortSignal,
): Promise<ExactValidation> {
	return request(`/areas:validate${query(release)}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
		signal,
	});
}

let releases: Promise<BoundaryRelease[]> | null = null;

/** Every boundary release, fetched once per visit. */
export function boundaryReleases(): Promise<BoundaryRelease[]> {
	releases ??= request<BoundaryRelease[]>("/boundary-releases").catch(
		(error) => {
			releases = null;
			throw error;
		},
	);
	return releases;
}

/** Fetches `load` once per visit, and again only after it fails. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
	let cached: Promise<T> | null = null;
	return () => {
		cached ??= load().catch((error) => {
			cached = null;
			throw error;
		});
		return cached;
	};
}

/** Every published crosswalk. */
export const crosswalks = once(() => request<Crosswalk[]>("/crosswalks"));

/** Every bulk lookup table, which is where a crosswalk's rows download from. */
export const bulkLookups = once(() =>
	request<{ lookups: BulkLookup[] }>("/lookups").then((data) => data.lookups),
);

/** One column of counts moved through a crosswalk. Nothing is stored. */
export function convertCounts(
	crosswalk: string,
	rows: { code: string; value: number }[],
	weighting?: "area" | "population",
	signal?: AbortSignal,
): Promise<ConvertedCounts> {
	const params = new URLSearchParams({ semantics: "count" });
	if (weighting) params.set("weighting", weighting);
	return request(
		`/crosswalks/${encodeURIComponent(crosswalk)}:convert?${params}`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ rows }),
			signal,
		},
	);
}

export interface MapTiles {
	tiles: string[];
	minzoom: number;
	maxzoom: number;
	bounds: [number, number, number, number];
	attribution: string;
	/** The layer in each tile that holds the areas. */
	layer: string;
}

/**
 * A release's vector tiles. The TileJSON comes in the API's envelope, with
 * tile paths relative to the API, so it is unwrapped here for MapLibre.
 */
export function mapTiles(
	release: ReleaseRef,
	signal?: AbortSignal,
): Promise<MapTiles> {
	const path = [release.geography, release.boundaryRelease]
		.map(encodeURIComponent)
		.join("/");
	return request<{
		tiles: string[];
		minzoom: number;
		maxzoom: number;
		bounds: [number, number, number, number];
		attribution: string;
		vector_layers: { id: string }[];
	}>(`/map-resources/${path}/tiles.json`, { signal }).then((json) => ({
		tiles: json.tiles.map((tile) =>
			tile.startsWith("/") ? `${API_ORIGIN}${tile}` : tile,
		),
		minzoom: json.minzoom,
		maxzoom: json.maxzoom,
		bounds: json.bounds,
		attribution: json.attribution,
		layer: json.vector_layers[0]?.id ?? "boundaries",
	}));
}

/** A lookup table as CSV, from the `href` its manifest gives. */
export async function lookupCsv(
	href: string,
	signal?: AbortSignal,
): Promise<string> {
	let response: Response;
	try {
		response = await fetch(`${API_ORIGIN}${href}`, { signal });
	} catch (error) {
		if ((error as Error).name === "AbortError") throw error;
		throw new ApiError(
			"Couldn't reach the UK Data Atlas API. Check your connection and try again.",
			0,
		);
	}
	if (!response.ok)
		throw new ApiError(
			`The API answered ${response.status} for a lookup table.`,
			response.status,
		);
	return response.text();
}

export function areaHistory(
	release: ReleaseRef,
	code: string,
	signal?: AbortSignal,
): Promise<AreaHistory> {
	const path = [release.geography, release.boundaryRelease, code]
		.map(encodeURIComponent)
		.join("/");
	return request(`/areas/${path}/history?depth=20`, { signal });
}

/** Runs `task` over `items`, at most `limit` at once, keeping their order. */
export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	task: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await task(items[index]);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, worker),
	);
	return results;
}
