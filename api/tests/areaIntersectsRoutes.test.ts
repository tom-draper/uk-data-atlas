import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("finds the areas meeting a box, and says how each meets it", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas:intersects?${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				areaGeometryCache,
			);
		const where = "geography=ward&release=2025-01-en-ward";
		const data = (response: ReturnType<typeof get>) =>
			("data" in response.body && response.body.data) as {
				matched: number;
				returned: number;
				truncated: boolean;
				matches: {
					code: string;
					relation: string;
					boundingBox: number[];
					geometry?: unknown;
					generalisation?: { vertices: number };
				}[];
			} & Record<string, never>;

		// A box that swallows the ward whole.
		const enclosing = get(`bbox=-3,53,0,56&${where}`);
		assert.equal(enclosing.status, 200);
		assert.equal(data(enclosing).matched, 1);
		assert.equal(data(enclosing).matches[0]!.relation, "within");
		assert.deepEqual(
			data(enclosing).matches[0]!.boundingBox,
			[-2, 54, -1, 55],
		);

		// A box that cuts across it.
		const cutting = get(`bbox=-1.5,54.5,0,56&${where}`);
		assert.equal(data(cutting).matches[0]!.relation, "overlaps");

		// A box nowhere near it is an empty answer, not an error.
		const elsewhere = get(`bbox=10,10,11,11&${where}`);
		assert.equal(elsewhere.status, 200);
		assert.equal(data(elsewhere).matched, 0);
		assert.deepEqual(data(elsewhere).matches, []);

		// Identities by default: the coordinates cost extra, and are opted into.
		assert.equal("geometry" in data(enclosing).matches[0]!, false);
		const withGeometry = get(`bbox=-3,53,0,56&${where}&tier=low`);
		assert.ok(data(withGeometry).matches[0]!.geometry);
		assert.equal(data(withGeometry).tier, "low");
		assert.ok(data(withGeometry).matches[0]!.generalisation!.vertices > 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("bounds a box query by result count and rejects a malformed one", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas:intersects?${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				new AreaGeometryCache(root, sources),
			);
		const where = "geography=ward&release=2025-01-en-ward";

		// One match, asked for none of it: still counted, and the cut is stated.
		const limited = get(`bbox=-3,53,0,56&${where}&limit=1`);
		const data = ("data" in limited.body && limited.body.data) as Record<
			string,
			never
		>;
		assert.equal(data.matched, 1);
		assert.equal(data.returned, 1);
		assert.equal(data.truncated, false);

		for (const query of [
			where, // no bbox at all
			`bbox=&${where}`,
			`bbox=1,2,3&${where}`, // three numbers
			`bbox=1,2,3,4,5&${where}`,
			`bbox=a,b,c,d&${where}`,
			`bbox=0,54,-1,55&${where}`, // west east of east
			`bbox=-2,55,-1,54&${where}`, // south north of north
			`bbox=-200,54,-1,55&${where}`, // off the globe
			`bbox=-2,54,-1,55&geography=ward`, // no release
			`bbox=-2,54,-1,55&${where}&limit=0`,
			`bbox=-2,54,-1,55&${where}&limit=1001`,
			`bbox=-2,54,-1,55&${where}&limit=1.5`,
			`bbox=-2,54,-1,55&${where}&tier=nope`,
		]) {
			assert.equal(get(query).status, 400, query);
		}

		// A release the catalogue does not carry is a 404, not a 400: the
		// request was well formed, there is just nothing to search.
		assert.equal(
			get(`bbox=-2,54,-1,55&geography=ward&release=1999-01-en-ward`)
				.status,
			404,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
