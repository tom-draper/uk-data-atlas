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
	containmentCrosswalk,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("draws every child of an area as one FeatureCollection", () => {
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
		const get = (query = "") =>
			route(
				"GET",
				`/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				new AreaGeometryCache(root, sources),
			);

		const response = get();
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as {
			type: string;
			parent: { code: string };
			collection: Record<string, never>;
			withoutGeometry: unknown[];
			features: {
				id: string;
				properties: Record<string, never>;
				geometry: { type: string };
			}[];
		};
		assert.equal(data.type, "FeatureCollection");
		assert.equal(data.parent.code, "E08000001");
		assert.equal(data.collection.members, 1);
		assert.equal(data.collection.withGeometry, 1);
		assert.equal(data.collection.tier, "full");
		assert.deepEqual(data.withoutGeometry, []);
		assert.equal(data.features.length, 1);

		const [child] = data.features;
		assert.equal(child!.id, "ward/2025-01-en-ward/E05000001");
		assert.equal(child!.geometry.type, "Polygon");
		// Membership is the crosswalk's published claim, carried with the
		// feature rather than implied by the collection it arrived in.
		assert.equal(
			(child!.properties.membership as unknown as { method: string })
				.method,
			"clean-containment",
		);

		// A coarser tier reports the method once for the collection, not on
		// every member.
		const coarse = get("?tier=low");
		const coarseData = ("data" in coarse.body && coarse.body.data) as {
			collection: Record<string, never>;
			features: { properties: Record<string, never> }[];
		};
		assert.equal(coarseData.collection.tier, "low");
		assert.ok("generalisationMethod" in coarseData.collection);
		assert.equal(
			"tier" in coarseData.features[0]!.properties.generalisation,
			false,
		);

		assert.equal(get("?tier=nope").status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("lists the children it could not draw rather than dropping them", () => {
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
		// The source exists but holds no feature for the child's code.
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({ type: "FeatureCollection", features: [] }),
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
		const response = route(
			"GET",
			"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			new AreaGeometryCache(root, sources),
		);
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as {
			collection: Record<string, never>;
			withoutGeometry: { code: string; reason: string }[];
			features: unknown[];
		};
		// A partial collection is still a 200, but it says what is missing and
		// why: members and withGeometry disagreeing is the signal.
		assert.equal(data.collection.members, 1);
		assert.equal(data.collection.withGeometry, 0);
		assert.equal(data.features.length, 0);
		assert.equal(data.withoutGeometry.length, 1);
		assert.equal(data.withoutGeometry[0]!.code, "E05000001");
		assert.match(
			data.withoutGeometry[0]!.reason,
			/No feature for this code/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses to draw children of several geographies as one collection", () => {
	const lsoaCrosswalk = {
		...containmentCrosswalk,
		contentHash: "sha256:lsoa-containment",
		id: "lsoa-to-local-authority-2025",
		from: { geography: "lsoa", boundaryRelease: "2021-12-ew" },
		records: [
			{
				source: { code: "E01000001", labels: ["Example LSOA"] },
				targets: [
					{ code: "E08000001", labels: ["Greater Manchester"] },
				],
			},
		],
	};
	const children = (query: string) =>
		route(
			"GET",
			`/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry${query}`,
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			new Map([...crosswalkLookup, [lsoaCrosswalk.id, lsoaCrosswalk]]),
			undefined,
			new AreaGeometryCache(tmpdir(), new Map()),
		);

	const mixed = children("");
	assert.equal(mixed.status, 409);
	assert.deepEqual("choices" in mixed.body && mixed.body.choices, [
		"lsoa/2021-12-ew",
		"ward/2025-01-en-ward",
	]);

	const wards = children("?childGeography=ward");
	assert.equal(wards.status, 200);
	const data = ("data" in wards.body && wards.body.data) as {
		collection: { members: number };
	};
	assert.equal(data.collection.members, 1);

	assert.equal(children("?childGeography=lsoa/2021-12-ew").status, 200);
	assert.equal(children("?childGeography=msoa").status, 404);
});
