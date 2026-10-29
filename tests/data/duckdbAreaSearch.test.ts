import { strict as assert } from "node:assert";
import { it } from "vitest";
import { createAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { compileAreaSearchIndex } from "@uk-data-atlas/atlas-runtime/areas";
import { compileDuckdbAreaSearchIndex } from "../../pipeline/src/duckdbAreaSearch";

it("builds area search postings from a fixture", async () => {
	const lookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:test",
			geography: "localAuthority",
			boundaryRelease: "2023",
			codeProperty: "CODE",
			nameProperty: "NAME",
			areas: [{ code: "E01", name: "York", aliases: ["Yörk"] }],
		},
	]);
	const index = await compileDuckdbAreaSearchIndex(lookup, "sha256:test");
	assert.deepEqual(index.releases, [
		{
			geography: "localAuthority",
			boundaryRelease: "2023",
			codes: ["E01"],
		},
	]);
	assert.deepEqual(index.terms, ["e01", "york"]);
	assert.deepEqual(index.termAreas, [[0], [0]]);
	assert.deepEqual(index.titleTerms, []);
});

it("matches Node postings for duplicates, aliases, accents and release order", async () => {
	const release = (
		boundaryRelease: string,
		areas: { code: string; name: string; aliases?: string[] }[],
	) => ({
		schemaVersion: 1 as const,
		contentHash: "sha256:test",
		geography: "localAuthority",
		boundaryRelease,
		codeProperty: "CODE",
		nameProperty: "NAME",
		areas,
	});
	const lookup = createAreaLookup([
		release("2023-v2", [
			{
				code: "W01",
				name: "Ynys Môn",
				aliases: ["Ynys Mon", "Isle of Anglesey"],
			},
			{
				code: "E01",
				name: "Bristol, City of",
				aliases: ["Bristol, City of"],
			},
		]),
		release("2023", [{ code: "E01", name: "Bristol, City of" }]),
	]);
	assert.deepEqual(
		await compileDuckdbAreaSearchIndex(lookup, "sha256:test"),
		compileAreaSearchIndex(lookup, "sha256:test"),
	);
	const empty = createAreaLookup([]);
	assert.deepEqual(
		await compileDuckdbAreaSearchIndex(empty, "sha256:empty"),
		compileAreaSearchIndex(empty, "sha256:empty"),
	);
});
