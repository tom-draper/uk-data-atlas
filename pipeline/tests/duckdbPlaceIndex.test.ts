import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../../shared/createAreaLookup";
import { compilePlaceIndex } from "../../shared/placeIndex";
import { compileDuckdbPlaceIndex } from "../src/duckdbPlaceIndex";

const release = (
	boundaryRelease: string,
	areas: { code: string; name: string; aliases?: string[] }[],
) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${boundaryRelease}`,
	geography: "localAuthority",
	boundaryRelease,
	codeProperty: "CODE",
	nameProperty: "NAME",
	areas,
});

test("DuckDB place index preserves Node label order, aliases and releases", async () => {
	const lookup = createAreaLookup([
		release("2021", [
			{
				code: "E08000003",
				name: "City of York",
				aliases: ["York", "City of York"],
			},
			{ code: "E08000004", name: "York", aliases: ["Yörk"] },
		]),
		release("2023", [
			{
				code: "E08000003",
				name: "York",
				aliases: ["City of York", "Yörk"],
			},
		]),
	]);
	const expected = compilePlaceIndex(lookup, undefined, "sha256:areas");
	assert.ok(expected.names.length > 0);
	assert.deepEqual(
		await compileDuckdbPlaceIndex(lookup, undefined, "sha256:areas"),
		expected,
	);
});
