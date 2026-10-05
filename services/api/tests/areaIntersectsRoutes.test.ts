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
					geometrySource?: unknown;
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
		const latest = get("bbox=-3,53,0,56&geography=ward&release=latest");
		assert.equal(latest.status, 200);
		assert.equal(data(latest).boundaryRelease, "2025-01-en-ward");
		assert.equal(data(latest).releaseSelection, "latest-published");

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
		assert.deepEqual(data(enclosing).matches[0]!.geometrySource, {
			sourceCrs: "EPSG:4326",
		});
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

test("does not materialise geometry beyond the requested box-result limit", () => {
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
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[1, 54],
									[2, 54],
									[2, 55],
									[1, 55],
									[1, 54],
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
		const cache = new AreaGeometryCache(root, sources);
		const response = route(
			"GET",
			"/v1/areas:intersects?bbox=-3,53,3,56&geography=ward&release=2025-01-en-ward&limit=1",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			cache,
		);
		const data = ("data" in response.body && response.body.data) as {
			matched: number;
			returned: number;
			matches: Array<{ code: string; geometry?: unknown }>;
		};
		assert.equal(data.matched, 2);
		assert.equal(data.returned, 1);
		assert.deepEqual(
			data.matches.map(({ code }) => code),
			["E05000001"],
		);
		assert.equal("geometry" in data.matches[0]!, false);
		assert.equal(cache.stats().reads, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("pages through every area a box meets", (t) => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = join(
		root,
		"data",
		"boundaries",
		"ward",
		"2025-01-en-ward",
	);
	mkdirSync(directory, { recursive: true });
	const square = (west: number) => [
		[
			[west, 54],
			[west + 1, 54],
			[west + 1, 55],
			[west, 55],
			[west, 54],
		],
	];
	writeFileSync(
		join(directory, "wards.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			// Listed out of code order: pages follow the codes.
			features: [
				["E05000002", -1],
				["E05000001", -2],
			].map(([code, west]) => ({
				properties: { WD25CD: code },
				geometry: {
					type: "Polygon",
					coordinates: square(west as number),
				},
			})),
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
	const cache = new AreaGeometryCache(root, sources);
	const get = (query: string) =>
		route(
			"GET",
			`/v1/areas:intersects?bbox=-3,53,1,56&geography=ward&release=2025-01-en-ward&limit=1${query}`,
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			cache,
		);
	const page = (response: ReturnType<typeof get>) => ({
		codes: (
			response.body as { data: { matches: Array<{ code: string }> } }
		).data.matches.map((match) => match.code),
		truncated: (response.body as { data: { truncated: boolean } }).data
			.truncated,
		nextCursor: (response.body as { meta: { nextCursor: string | null } })
			.meta.nextCursor,
	});

	const first = get("");
	assert.deepEqual(page(first).codes, ["E05000001"]);
	assert.equal(page(first).truncated, true);
	const cursor = page(first).nextCursor!;
	assert.ok(cursor);
	assert.match(first.headers!.link!, /cursor=.*rel="next"/);

	const second = get(`&cursor=${cursor}`);
	assert.deepEqual(page(second), {
		codes: ["E05000002"],
		truncated: false,
		nextCursor: null,
	});
	assert.equal(second.headers?.link, undefined);

	assert.equal(get("&cursor=not-ours!").status, 400);
});
