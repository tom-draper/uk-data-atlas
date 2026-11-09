import { featureIds } from "./featureIds.ts";

/**
 * Map values: one array of numbers per (measure, boundary release, year), in
 * the order of the release's code list, so the value at index `i` belongs to
 * the area whose tile feature id is `i + 1` (see `featureIds`). A renderer
 * holds it as feature state against the tiles and needs no area codes, names
 * or geometry to do so.
 *
 * Nothing in the array says which areas it covers, so the manifest records the
 * code list each array was made against. A reader that holds a different code
 * list refuses the array rather than colouring the wrong areas.
 */

export const MAP_VALUES_SCHEMA_VERSION = 1;

/** Which code list an array is ordered by: how many codes, and a digest of them. */
export type CodeListId = { count: number; version: string };

export type MapValuesEntry = {
	/** Path of the array file, relative to the manifest's folder. */
	file: string;
	/** The dataset record field the values came from. */
	field: string;
	bytes: number;
	sha256: string;
	codeList: CodeListId;
	/** How many areas have a value, the rest being `null`. */
	valueCount: number;
};

export type MapValuesManifest = {
	schemaVersion: typeof MAP_VALUES_SCHEMA_VERSION;
	entries: Record<string, MapValuesEntry>;
};

/** The values by code-list index, `null` where an area has none. */
export type MapValues = readonly (number | null)[];

/** Raised when an array cannot be trusted to line up with the areas it will colour. */
export class MapValuesMismatchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MapValuesMismatchError";
	}
}

/** The manifest key for one array: `<measure>/<geography>/<release>/<year>`. */
export const mapValuesKey = (
	measure: string,
	release: string,
	year: number,
): string => `${measure}/${release}/${year}`;

/**
 * A release's code list: its codes in the order `featureIds` numbers them.
 * Derived from `featureIds` itself so the two cannot disagree. A repeated code
 * would be numbered twice there, so it is refused rather than guessed at.
 */
export const releaseCodeList = (codes: Iterable<string>): string[] => {
	const all = [...codes];
	const list = [...featureIds(all).keys()];
	if (list.length !== all.length)
		throw new MapValuesMismatchError(
			`A release's code list has ${all.length - list.length} repeated codes`,
		);
	return list;
};

/** A 53-bit string hash (cyrb53): no Node crypto, so it runs in the browser. */
const digest = (text: string): string => {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index);
		h1 = Math.imul(h1 ^ unit, 2654435761);
		h2 = Math.imul(h2 ^ unit, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

/** Identifies a code list by its codes and their order. */
export const codeListId = (codeList: readonly string[]): CodeListId => ({
	count: codeList.length,
	version: digest(codeList.join("\n")),
});

/**
 * The values for each code of a code list, in its order. Anything that is not
 * a finite number is missing, as it is when the old join colours a feature.
 */
export const orderValues = (
	codeList: readonly string[],
	valueFor: (code: string) => unknown,
): (number | null)[] =>
	codeList.map((code) => {
		const value = valueFor(code);
		return typeof value === "number" && Number.isFinite(value)
			? value
			: null;
	});

export const encodeMapValues = (values: MapValues): string =>
	JSON.stringify(values);

/**
 * Reads an array file against the code list the reader holds, throwing if the
 * manifest entry was made for another code list or the array has the wrong
 * length or an entry that is not a number or `null`.
 */
export const readMapValues = (
	text: string,
	entry: MapValuesEntry,
	codeList: CodeListId,
	label = entry.file,
): MapValues => {
	if (
		entry.codeList.count !== codeList.count ||
		entry.codeList.version !== codeList.version
	)
		throw new MapValuesMismatchError(
			`Map values ${label} were made for a code list of ${entry.codeList.count} areas (${entry.codeList.version}), not the ${codeList.count} areas (${codeList.version}) being drawn`,
		);
	const values: unknown = JSON.parse(text);
	if (!Array.isArray(values) || values.length !== codeList.count)
		throw new MapValuesMismatchError(
			`Map values ${label} hold ${Array.isArray(values) ? values.length : "no array of"} values for ${codeList.count} areas`,
		);
	for (const value of values)
		if (value !== null && !Number.isFinite(value))
			throw new MapValuesMismatchError(
				`Map values ${label} hold ${JSON.stringify(value)}, which is neither a number nor null`,
			);
	return values as MapValues;
};

/** Checks a parsed manifest has the shape this reader understands. */
export const parseMapValuesManifest = (json: unknown): MapValuesManifest => {
	const manifest = json as Partial<MapValuesManifest> | null;
	if (
		!manifest ||
		manifest.schemaVersion !== MAP_VALUES_SCHEMA_VERSION ||
		typeof manifest.entries !== "object" ||
		manifest.entries === null
	)
		throw new MapValuesMismatchError(
			`Map values manifest has schema ${String(manifest?.schemaVersion)}, expected ${MAP_VALUES_SCHEMA_VERSION}`,
		);
	return manifest as MapValuesManifest;
};
