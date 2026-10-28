import {
	LazyAreaLookup,
	type AreaInventory,
	type AreaLookup,
} from "@uk-data-atlas/areas";
import {
	readSqliteAreaInventory,
	readSqliteAreas,
} from "../storage/atlasAreaReader";

/**
 * Area records kept parsed at once, about 125 bytes each. Every release
 * compiled today, about 574,000 records, fits. Some routes read every
 * release of a geography in one request, so a budget smaller than a
 * geography's releases would re-read files on each such request.
 */
export const DEFAULT_AREA_CACHE_RECORDS = 1_000_000;

export const readAreaLookup = (
	apiRoot: string,
	inventory: AreaInventory = readSqliteAreaInventory(apiRoot),
	maxRecords = DEFAULT_AREA_CACHE_RECORDS,
): AreaLookup =>
	new LazyAreaLookup(
		(release) => readSqliteAreas(apiRoot, release),
		inventory,
		maxRecords,
	);
