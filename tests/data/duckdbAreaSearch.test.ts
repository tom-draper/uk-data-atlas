import { strict as assert } from "node:assert";
import { it } from "vitest";
import { createAreaLookup } from "../../shared/createAreaLookup";
import { compileAreaSearchIndex } from "../../shared/areaSearchCompiler";
import { compileDuckdbAreaSearchIndex } from "../../pipeline/src/duckdbAreaSearch";

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
