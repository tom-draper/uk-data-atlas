import assert from "node:assert/strict";
import test from "node:test";
import {
	assignAuthority,
	countyMemberships,
	withCeremonialCounties,
	type CountyShape,
} from "../src/ceremonialCounties";
import type { NamedLocation } from "../src/namedLocations";

const box = (west: number, south: number, east: number, north: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[west, south],
			[east, south],
			[east, north],
			[west, north],
			[west, south],
		],
	],
});

const county = (name: string, west: number, east: number): CountyShape => ({
	name,
	geometry: box(west, 50, east, 51),
	bounds: [west, 50, east, 51],
});

// Two counties side by side, meeting at longitude 0.
const counties = [county("Westshire", -2, 0), county("Eastshire", 0, 2)];

test("assigns an authority to the county holding most of it, and says where it is split", () => {
	const whole = assignAuthority(box(-1.5, 50.2, -0.5, 50.8), counties)!;
	assert.equal(whole.county, "Westshire");
	assert.equal(whole.share, 1);
	assert.deepEqual(whole.elsewhere, []);

	// Three quarters west of the line, a quarter east.
	const split = assignAuthority(box(-1.5, 50.2, 0.5, 50.8), counties)!;
	assert.equal(split.county, "Westshire");
	assert.ok(Math.abs(split.share - 0.75) < 0.01);
	assert.equal(split.elsewhere[0]!.county, "Eastshire");

	// Mostly outside every county, as a council over the border is.
	assert.equal(assignAuthority(box(-1, 50.8, 0, 52), counties), undefined);
});

test("dates each member by the releases it appears in", () => {
	const west = box(-1.5, 50.2, -0.5, 50.8);
	const memberships = countyMemberships(
		[
			{
				month: "2019-12",
				authorities: [{ code: "OLD", geometry: west }],
			},
			{
				month: "2023-05",
				authorities: [{ code: "NEW", geometry: west }],
			},
			{
				month: "2021-12",
				authorities: [{ code: "OLD", geometry: west }],
			},
		],
		counties,
	);
	assert.deepEqual(memberships, [
		{
			county: "Westshire",
			members: [
				{ code: "NEW", validity: { from: "2023-05-01", to: null } },
				{ code: "OLD", validity: { from: null, to: "2023-05-01" } },
			],
			split: [],
		},
	]);
});

const location = (
	id: string,
	kind: NamedLocation["kind"],
	memberCodes: string[],
): NamedLocation => ({
	id,
	label: id,
	kind,
	definitionRevision: 1,
	memberGeography: "localAuthority",
	memberCodes,
	validity: { from: null, to: null },
	bbox: [0, 0, 1, 1],
});

test("takes over a curated grouping, stands beside a different official area, and skips an identical one", () => {
	const members = (codes: string[]) =>
		codes.map((code) => ({ code, validity: { from: null, to: null } }));
	const merged = withCeremonialCounties(
		[
			location("westshire", "editorial-grouping", ["A"]),
			// A region reaching into Westshire too, so it is not the county.
			location("eastshire", "region", ["A", "B"]),
			location("northshire", "county", ["D", "OLD-D"]),
		],
		[
			{ county: "Westshire", members: members(["A", "A2"]), split: [] },
			{ county: "Eastshire", members: members(["B"]), split: [] },
			// The same councils as the official county, but for a code it
			// keeps from before a reorganisation.
			{ county: "Northshire", members: members(["D"]), split: [] },
		],
		[...counties, county("Northshire", 4, 5)],
	);
	const byId = new Map(merged.map((entry) => [entry.id, entry]));
	const west = byId.get("westshire")!;
	assert.equal(west.kind, "ceremonial-county");
	assert.equal(west.definitionRevision, 2);
	assert.deepEqual(west.memberCodes, ["A", "A2"]);
	assert.equal(
		west.source && "name" in west.source && west.source.name,
		"Westshire",
	);

	assert.equal(byId.get("eastshire")!.kind, "region");
	const east = byId.get("eastshire-ceremonial-county")!;
	assert.equal(east.label, "Eastshire (ceremonial county)");
	assert.deepEqual(east.memberCodes, ["B"]);

	assert.equal(byId.get("northshire")!.kind, "county");
	assert.equal(byId.has("northshire-ceremonial-county"), false);
});

test("lists an authority's smaller part on the county that holds it", () => {
	const merged = withCeremonialCounties(
		[],
		[
			{
				county: "Westshire",
				members: [{ code: "S", validity: { from: null, to: null } }],
				split: [
					{
						code: "S",
						county: "Westshire",
						share: 0.79,
						elsewhere: [{ county: "Eastshire", share: 0.21 }],
					},
				],
			},
			{
				county: "Eastshire",
				members: [{ code: "E", validity: { from: null, to: null } }],
				split: [],
			},
		],
		counties,
	);
	const east = merged.find((entry) => entry.id === "eastshire")!;
	assert.deepEqual(east.partialMembers, [
		{ code: "S", share: 0.21, memberOf: "westshire" },
	]);
	assert.equal(
		merged.find((entry) => entry.id === "westshire")!.partialMembers,
		undefined,
	);
});
