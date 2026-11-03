import assert from "node:assert/strict";
import { test } from "vitest";
import {
	compileAreaSearchIndex,
	createAreaLookup,
} from "@uk-data-atlas/atlas-runtime/areas";
import { compilePlaceIndex } from "@uk-data-atlas/atlas-runtime/places";
import type { NamedLocationInventory } from "@uk-data-atlas/places";
import { compileDuckdbAreaSearchIndex } from "../src/duckdbAreaSearch";
import { compileDuckdbPlaceIndex } from "../src/duckdbPlaceIndex";

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

const lookup = createAreaLookup([
	release("ward", "2023", [
		{ code: "E05000001", name: "York" },
		{ code: "E05000002", name: "City of York", aliases: ["York", "Yörk"] },
	]),
	release("localAuthority", "2023", [
		{ code: "E06000001", name: "City of York", aliases: ["York", "York"] },
		{ code: "W06000001", name: "Isle of Anglesey", aliases: ["Ynys Môn"] },
	]),
	release("localAuthority", "2021", [
		{ code: "E06000001", name: "York", aliases: ["City of York"] },
	]),
]);

const locations: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: { artifact: "gazetteer.json", gazetteerVersion: 1 },
	locations: [
		{
			id: "york-region",
			label: "York",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "localAuthority",
			memberCodes: ["E06000001"],
			validity: { from: null, to: null },
			bbox: [-2, 53, -1, 54],
		},
	],
};

for (const [name, areas] of [
	["populated", lookup],
	["empty", createAreaLookup([])],
] as const) {
	test(`area search compilers produce identical ${name} artifacts`, async () => {
		assert.deepEqual(
			await compileDuckdbAreaSearchIndex(areas, "sha256:areas"),
			compileAreaSearchIndex(areas, "sha256:areas"),
		);
	});

	test(`place index compilers produce identical ${name} artifacts`, async () => {
		const namedLocations = name === "populated" ? locations : undefined;
		assert.deepEqual(
			await compileDuckdbPlaceIndex(
				areas,
				namedLocations,
				"sha256:areas",
			),
			compilePlaceIndex(areas, namedLocations, "sha256:areas"),
		);
	});
}
