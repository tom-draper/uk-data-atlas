import { withCDN } from "@/lib/helpers/cdn";
import {
	mapValuesKey,
	parseMapValuesManifest,
	readMapValues,
	codeListId,
	type MapValues,
	type MapValuesManifest,
} from "@uk-data-atlas/map-tiles/mapValues";

const BASE = "/data/map-values";

/** What identifies one array: the measure, the boundary release and the year. */
export type MapValuesRequest = {
	measure: string;
	/** The dataset record field the map colours by, which the array must come from. */
	field: string;
	/** The boundary release, as `<geography>/<release id>`. */
	release: string;
	year: number;
	/** The code list of the tiles being drawn, which the array must be ordered by. */
	codeList: readonly string[];
};

export const mapValuesRequestKey = (request: MapValuesRequest): string =>
	`${mapValuesKey(request.measure, request.release, request.year)}\u0000${request.field}`;

let manifest: Promise<MapValuesManifest | null> | undefined;
const arrays = new Map<string, Promise<MapValues>>();

/** The build's manifest, or null when this build made no map values. */
function fetchManifest(): Promise<MapValuesManifest | null> {
	return (manifest ??= fetch(withCDN(`${BASE}/manifest.json`))
		.then(async (response) => {
			if (response.status === 404) return null;
			if (!response.ok)
				throw new Error(`Map values manifest: ${response.status}`);
			return parseMapValuesManifest(await response.json());
		})
		.catch((error: unknown) => {
			manifest = undefined;
			throw error;
		}));
}

/**
 * The array for a request, or null when the build made none for it (so the
 * caller joins the dataset onto the features instead). An array made for a
 * different code list than the tiles' throws `MapValuesMismatchError` rather
 * than colouring the wrong areas.
 */
export async function fetchMapValues(
	request: MapValuesRequest,
): Promise<MapValues | null> {
	const entry = (await fetchManifest())?.entries[
		mapValuesKey(request.measure, request.release, request.year)
	];
	if (!entry || entry.field !== request.field) return null;
	const list = codeListId(request.codeList as string[]);
	const cacheKey = `${entry.file}\u0000${list.version}`;
	let values = arrays.get(cacheKey);
	if (!values) {
		values = fetch(withCDN(`${BASE}/${entry.file}`))
			.then(async (response) => {
				if (!response.ok)
					throw new Error(
						`Map values ${entry.file}: ${response.status}`,
					);
				return readMapValues(await response.text(), entry, list);
			})
			.catch((error: unknown) => {
				arrays.delete(cacheKey);
				throw error;
			});
		arrays.set(cacheKey, values);
	}
	return values;
}
