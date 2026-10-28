import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
	readPlaceIndex,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { compilePlaceIndex } from "@uk-data-atlas/atlas-runtime/places";
import { resolvePlaces } from "@uk-data-atlas/atlas-runtime/places";
import { atEach, type Indexed } from "@uk-data-atlas/search-index";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const areas = readAreaInventory(apiRoot);
const locations = readNamedLocationInventory(apiRoot);
const expected = compilePlaceIndex(
	readAreaLookup(apiRoot, areas),
	locations,
	areas.contentHash,
	readBoundaryRegistry(apiRoot),
);
const actual = readPlaceIndex(apiRoot, areas, locations);
assert.deepEqual(actual.releases, expected.releases);
function compare<T>(name: string, wanted: T[], stored: Indexed<T>) {
	assert.equal(stored.length, wanted.length, name);
	for (let start = 0; start < wanted.length; start += 512) {
		const batch = wanted.slice(start, start + 512);
		assert.deepEqual(
			atEach(
				stored,
				batch.map((_, offset) => start + offset),
			),
			batch,
			`${name} at ${start}`,
		);
	}
}
compare("places", expected.places, actual.places);
compare("names", expected.names, actual.names);
compare("labels", expected.labels, actual.labels);
compare("codes", expected.codes, actual.codes);
compare("codePlaces", expected.codePlaces, actual.codePlaces);
for (const query of [
	"Manchester",
	"manc",
	"Bristol",
	"Ynys Mon",
	"E08000003",
	"localAuthority/E08000003",
	"location/greater-manchester",
	"Greater Manchester",
	"zz",
	"",
])
	for (const asOf of [undefined, "2024-01-01"])
		assert.deepEqual(
			resolvePlaces(actual, query, 10, asOf),
			resolvePlaces(expected, query, 10, asOf),
			query,
		);
console.log(
	`Matched all ${expected.places.length} places, ${expected.names.length} names, labels, codes and search results against freshly compiled inputs.`,
);
