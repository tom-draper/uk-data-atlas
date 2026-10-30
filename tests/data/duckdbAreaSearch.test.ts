import { strict as assert } from "node:assert";
import { it } from "vitest";
import { createAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
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
