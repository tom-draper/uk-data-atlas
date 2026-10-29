import assert from "node:assert/strict";
import { test } from "vitest";
import { createAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { compilePlaceIndex } from "@uk-data-atlas/atlas-runtime/places";
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

test("DuckDB place index builds searchable aliases from a fixture", async () => {
	const lookup = createAreaLookup([
		release("2023", [{ code: "E01", name: "York", aliases: ["Yörk"] }]),
	]);
	const index = await compileDuckdbPlaceIndex(
		lookup,
		undefined,
		"sha256:test",
	);
	assert.deepEqual(index.places, [
		{
			place: "localAuthority/E01",
			kind: "area",
			geography: "localAuthority",
			code: "E01",
			name: "York",
			boundaryReleases: [0],
		},
	]);
	assert.deepEqual(index.releases, ["2023"]);
	assert.deepEqual(index.names, ["york"]);
	assert.deepEqual(index.labels, [
		[
			[0, 0],
			[0, 0, "Yörk"],
		],
	]);
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
