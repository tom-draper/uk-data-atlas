import { writeSqliteIndex } from "@uk-data-atlas/atlas-runtime/storage";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import {
	AreaSearch,
	areaSearchIndexMismatch,
	compileAreaSearchIndex,
	openAreaSearchIndexDatabase,
	areaSearchIndexTables,
} from "@uk-data-atlas/atlas-runtime/areas";

const release = (
	geography: string,
	boundaryRelease: string,
	areas: { code: string; name: string; aliases?: string[] }[],
) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${geography}-${boundaryRelease}`,
	geography,
	boundaryRelease,
	codeProperty: "CODE",
	nameProperty: "NAME",
	areas,
});

const areaLookup = createAreaLookup([
	release("localAuthority", "2023-05-uk-bgc-v2", [
		{ code: "E08000003", name: "Manchester" },
		{ code: "E06000023", name: "Bristol, City of" },
		{ code: "W06000001", name: "Isle of Anglesey", aliases: ["Ynys Môn"] },
	]),
	// Sorts after the -v2 release by code unit: "-" comes before "/".
	release("localAuthority", "2023-05-uk-bgc", [
		{ code: "E08000003", name: "Manchester" },
	]),
	release("ward", "2023-05-uk-bgc", [
		{ code: "E05000002", name: "Manchester Central" },
		{ code: "E05000001", name: "Bristol" },
	]),
]);

const index = compileAreaSearchIndex(areaLookup, "sha256:areas");
const search = new AreaSearch(index, areaLookup);
const ids = (query: Parameters<AreaSearch["search"]>[0]) => {
	const matches = search.search(query);
	return matches.slice(0, matches.length).map((area) => area.id);
};

test("lists every identity in code-unit id order, releases contiguous", () => {
	assert.deepEqual(ids({}), [
		"localAuthority/2023-05-uk-bgc-v2/E06000023",
		"localAuthority/2023-05-uk-bgc-v2/E08000003",
		"localAuthority/2023-05-uk-bgc-v2/W06000001",
		"localAuthority/2023-05-uk-bgc/E08000003",
		"ward/2023-05-uk-bgc/E05000001",
		"ward/2023-05-uk-bgc/E05000002",
	]);
	assert.deepEqual(ids({ geography: "ward" }), [
		"ward/2023-05-uk-bgc/E05000001",
		"ward/2023-05-uk-bgc/E05000002",
	]);
	assert.deepEqual(ids({ boundaryRelease: "2023-05-uk-bgc" }), [
		"localAuthority/2023-05-uk-bgc/E08000003",
		"ward/2023-05-uk-bgc/E05000001",
		"ward/2023-05-uk-bgc/E05000002",
	]);
});

test("prefers an exact code to names that begin with the query", () => {
	assert.deepEqual(ids({ query: "e08000003" }), [
		"localAuthority/2023-05-uk-bgc-v2/E08000003",
		"localAuthority/2023-05-uk-bgc/E08000003",
	]);
	assert.deepEqual(ids({ query: "manc", geography: "ward" }), [
		"ward/2023-05-uk-bgc/E05000002",
	]);
	assert.deepEqual(ids({ query: "ynys mon" }), [
		"localAuthority/2023-05-uk-bgc-v2/W06000001",
	]);
	assert.deepEqual(ids({ query: "!!!" }), []);
});

test("finds a page's cursor among the matches without reading them all", () => {
	const matches = search.search({ query: "man" });
	assert.equal(matches.length, 3);
	assert.equal(matches.positionOf("ward/2023-05-uk-bgc/E05000002"), 2);
	// An identity that exists but did not match, and one that does not exist.
	assert.equal(matches.positionOf("ward/2023-05-uk-bgc/E05000001"), -1);
	assert.equal(matches.positionOf("ward/2099-01-uk/E05000001"), -1);
	assert.equal(matches.positionOf("not-an-id"), -1);
});

test("offers exact candidates including names with a title set aside", () => {
	assert.deepEqual(
		search.exactCandidates({ query: "Bristol" }).map((area) => area.id),
		[
			"localAuthority/2023-05-uk-bgc-v2/E06000023",
			"ward/2023-05-uk-bgc/E05000001",
		],
	);
	assert.deepEqual(
		search
			.exactCandidates({ query: "Bristol", geography: "ward" })
			.map((area) => area.name),
		["Bristol"],
	);
	// Prefixes are not exact candidates.
	assert.deepEqual(search.exactCandidates({ query: "Manc" }), []);
});

test("serves a compiled index only against the inventory it was built from", () => {
	assert.equal(areaSearchIndexMismatch(index, "sha256:areas"), undefined);
	assert.match(
		areaSearchIndexMismatch(index, "sha256:other")!,
		/area inventory/,
	);
	assert.match(
		areaSearchIndexMismatch(
			{ ...index, nameNormalisation: "sha256:older-rules" },
			"sha256:areas",
		)!,
		/name rules/,
	);
	assert.match(
		areaSearchIndexMismatch(
			{ ...index, termAreas: index.termAreas.slice(1) },
			"sha256:areas",
		)!,
		/malformed/,
	);
});

test("pages a listing the same however it is sliced", () => {
	for (const filters of [
		{},
		{ geography: "localAuthority" },
		{ geography: "ward" },
		{ geography: "localAuthority", boundaryRelease: "2023-05-uk-bgc" },
		{ geography: "region" },
	]) {
		const matches = search.search(filters);
		const all = ids(filters);
		assert.equal(matches.length, all.length);
		for (let start = 0; start <= all.length; start += 1)
			for (let end = start; end <= all.length + 1; end += 1)
				assert.deepEqual(
					matches.slice(start, end).map((area) => area.id),
					all.slice(start, end),
				);
		all.forEach((id, position) =>
			assert.equal(matches.positionOf(id), position),
		);
		assert.equal(matches.positionOf("ward/2023-05-uk-bgc/E05999999"), -1);
	}
	assert.equal(
		search
			.search({ geography: "ward" })
			.positionOf("localAuthority/2023-05-uk-bgc-v2/E08000003"),
		-1,
	);
});

test("answers from its SQLite tables exactly as from the artifact", (context) => {
	const directory = mkdtempSync(join(tmpdir(), "area-search-"));
	context.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "atlas.sqlite");
	writeSqliteIndex(
		path,
		{ schemaVersion: "1" },
		areaSearchIndexTables(index),
	);
	const stored = openAreaSearchIndexDatabase(path, "sha256:areas");
	assert.equal(stored.contentHash, index.contentHash);
	const fromStore = new AreaSearch(stored, areaLookup);
	for (const filters of [
		{},
		{ geography: "ward" },
		{ boundaryRelease: "2023-05-uk-bgc" },
		{ query: "Manchester" },
		{ query: "man" },
		{ query: "e08000003" },
		{ query: "Bristol" },
		{ query: "Ynys Mon", geography: "localAuthority" },
		{ query: "zz" },
	]) {
		const expected = search.search(filters);
		const actual = fromStore.search(filters);
		assert.deepEqual(
			actual.slice(0, actual.length),
			expected.slice(0, expected.length),
		);
		for (const area of expected.slice(0, expected.length))
			assert.equal(
				actual.positionOf(area.id),
				expected.positionOf(area.id),
			);
		if (filters.query)
			assert.deepEqual(
				fromStore.exactCandidates({ ...filters, query: filters.query }),
				search.exactCandidates({ ...filters, query: filters.query }),
			);
	}
	assert.throws(
		() => openAreaSearchIndexDatabase(path, "sha256:other"),
		/area inventory/,
	);
});
