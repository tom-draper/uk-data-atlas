import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
	readAreaInventory,
	readAreaLookup,
	readAreaSearchIndex,
} from "../shared/boundaryLoader";
import { AreaSearch, compileAreaSearchIndex } from "../shared/areaSearch";
import { atEach, type Indexed } from "../shared/sortedIndex";
import { apiRootOf } from "../shared/dataLayout";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const inventory = readAreaInventory(apiRoot);
const lookup = readAreaLookup(apiRoot, inventory);
const expected = compileAreaSearchIndex(lookup, inventory.contentHash);
const actual = readAreaSearchIndex(apiRoot, inventory);
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
assert.equal(actual.releases.length, expected.releases.length);
for (const [at, release] of expected.releases.entries()) {
	const stored = actual.releases[at]!;
	assert.equal(stored.geography, release.geography);
	assert.equal(stored.boundaryRelease, release.boundaryRelease);
	compare(
		`codes for ${release.geography}/${release.boundaryRelease}`,
		release.codes,
		stored.codes,
	);
}
compare("terms", expected.terms, actual.terms);
compare("termAreas", expected.termAreas, actual.termAreas);
compare("titleTerms", expected.titleTerms, actual.titleTerms);
compare("titleTermAreas", expected.titleTermAreas, actual.titleTermAreas);
const compiledSearch = new AreaSearch(expected, lookup);
const storedSearch = new AreaSearch(actual, lookup);
for (const query of [
	undefined,
	"Manchester",
	"manc",
	"Bristol",
	"Ynys Mon",
	"E08000003",
	"zz",
])
	for (const filters of [
		{},
		{ geography: "ward" },
		{ geography: "localAuthority" },
		{ boundaryRelease: "2023-05-uk-bgc" },
	]) {
		const wanted = compiledSearch.search({ ...filters, query });
		const stored = storedSearch.search({ ...filters, query });
		assert.equal(stored.length, wanted.length);
		for (const start of [0, 3, Math.max(0, wanted.length - 5)]) {
			const page = wanted.slice(start, start + 5);
			assert.deepEqual(stored.slice(start, start + 5), page);
			for (const area of page)
				assert.equal(
					stored.positionOf(area.id),
					wanted.positionOf(area.id),
				);
		}
		if (query)
			assert.deepEqual(
				storedSearch.exactCandidates({ ...filters, query }),
				compiledSearch.exactCandidates({ ...filters, query }),
			);
	}
console.log(
	`Matched ${expected.releases.reduce((total, release) => total + release.codes.length, 0)} area identities, ${expected.terms.length} terms, postings and filtered search pages against freshly compiled inputs.`,
);
