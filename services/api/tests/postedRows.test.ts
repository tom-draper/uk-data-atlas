import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import type { MapResourceDescriptor } from "../src/mapResource/compileMapResource";
import { readPostedRows } from "../src/requestRows";
import { route } from "../src/routes";
import type { RequestBody, RouteContext } from "../src/routing";
import { areaLookup, registry, testContext } from "./routeFixtures";

const json = (value: unknown): RequestBody => ({
	contentType: "application/json",
	text: JSON.stringify(value),
});
const csv = (text: string): RequestBody => ({ contentType: "text/csv", text });

const context = testContext({ boundaryRegistry: registry, areaLookup });
const post = (url: string, body: RequestBody, on: RouteContext = context) =>
	route("POST", url, on, body);
const data = <T>(response: ReturnType<typeof post>) =>
	(response.body as { data: T }).data;

const JOIN = "/v1/boundary-releases/ward/2025-01-en-ward:join";

test("reads a column of rows from JSON or CSV, and says why it cannot", () => {
	assert.deepEqual(
		readPostedRows(json({ values: ["E05000001", "Other"] }), {
			withValues: false,
		}),
		{
			areas: ["E05000001", "Other"],
		},
	);
	assert.deepEqual(
		readPostedRows(
			csv('code,value,parent\nE05000001,12.5,North\n"Other, ward",,\n'),
			{ withValues: true },
		),
		{
			areas: ["E05000001", "Other, ward"],
			parents: ["North", ""],
			values: [12.5, null],
		},
	);
	assert.deepEqual(
		readPostedRows(
			json({ rows: [{ name: "Other ward", value: "high" }] }),
			{
				withValues: true,
			},
		),
		{ areas: ["Other ward"], values: ["high"] },
	);
	const refused = (body: RequestBody, withValues = true) => {
		const read = readPostedRows(body, { withValues });
		return "status" in read ? read.status : undefined;
	};
	assert.equal(
		refused({ contentType: "text/plain", text: "E05000001" }),
		415,
	);
	assert.equal(refused({ contentType: "application/json", text: "{" }), 400);
	assert.equal(refused(json({ rows: [] })), 400);
	assert.equal(refused(csv("code\nE05000001")), 400, "a join needs values");
	assert.equal(refused(json({ rows: [{ area: 7, value: 1 }] })), 400);
	assert.equal(
		refused(json({ rows: [{ area: "E05000001", value: {} }] })),
		400,
	);
});

test("keeps a quoted line break in its field, and reads only decimals as numbers", () => {
	assert.deepEqual(
		readPostedRows(
			csv(
				'area,value\r\n"Ward\nwith a break",0x1A\r\nE05000001,1e3\nE05000002," -2.5 "\n"E05000003",1_000\n',
			),
			{ withValues: true },
		),
		{
			areas: [
				"Ward\nwith a break",
				"E05000001",
				"E05000002",
				"E05000003",
			],
			values: ["0x1A", 1000, -2.5, "1_000"],
		},
	);
});

test("reads a body curl sends as form-urlencoded by its first character", () => {
	const form = (text: string): RequestBody => ({
		contentType: "application/x-www-form-urlencoded",
		text,
	});
	assert.deepEqual(
		readPostedRows(form("area,value\nE05000001,2\n"), { withValues: true }),
		{ areas: ["E05000001"], values: [2] },
	);
	assert.deepEqual(
		readPostedRows(form('  {"values": ["E05000001"]}'), {
			withValues: false,
		}),
		{ areas: ["E05000001"] },
	);
	assert.deepEqual(
		readPostedRows(
			{ contentType: "", text: "area\nE05000001\n" },
			{ withValues: false },
		),
		{ areas: ["E05000001"] },
	);
});

test("validates a POSTed column exactly as the same values in a GET", () => {
	const values = ["E05000001", "enghraifft ward", "E05999999"];
	const got = route(
		"GET",
		`/v1/areas:validate?geography=ward&release=2025-01-en-ward&${values.map((value) => `value=${encodeURIComponent(value)}`).join("&")}`,
		context,
	);
	const posted = post(
		"/v1/areas:validate?geography=ward&release=2025-01-en-ward",
		json({ values }),
	);
	assert.equal(posted.status, 200);
	assert.deepEqual(posted.body, got.body);
	assert.deepEqual(
		post(
			"/v1/areas:validate?geography=ward&release=2025-01-en-ward",
			csv(`area\n${values.join("\n")}`),
		).body,
		got.body,
	);
});

test("refuses a POST to a route that only reads", () => {
	const refused = post("/v1/geographies", json({ values: ["x"] }));
	assert.equal(refused.status, 405);
	assert.equal(route("PUT", "/v1/geographies", context).status, 405);
});

test("joins rows to a release, numbered as its tiles, and lists what did not join", () => {
	const joined = post(
		JOIN,
		json({
			rows: [
				{ area: "E05000002", value: 20 },
				{ area: "Example ward", value: 10 },
				{ area: "Nowhere ward", value: 1 },
			],
		}),
	);
	assert.equal(joined.status, 200);
	const result = data<{
		summary: Record<string, number>;
		values: Array<{ id: number; code: string; value: unknown }>;
		unjoined: Array<{ index: number; reason: string }>;
	}>(joined);
	// Ids are each code's place in the release's sorted codes, as the tiles'.
	assert.deepEqual(
		result.values.map(({ id, code, value }) => [id, code, value]),
		[
			[1, "E05000001", 10],
			[2, "E05000002", 20],
		],
	);
	assert.deepEqual(
		result.unjoined.map(({ index, reason }) => [index, reason]),
		[[2, "unmatched"]],
	);
	assert.deepEqual(result.summary, {
		rows: 3,
		joined: 2,
		unjoined: 1,
		duplicateAreas: 0,
		areasWithoutValue: 0,
	});
});

test("never chooses between two values for one area", () => {
	const result = data<{
		values: unknown[];
		unjoined: Array<{ index: number; reason: string; sameAreaAs?: number }>;
		summary: { duplicateAreas: number; areasWithoutValue: number };
	}>(post(JOIN, csv("code,value\nE05000001,1\nexample ward,2\nE05000002,3")));
	assert.equal(result.values.length, 1);
	assert.deepEqual(result.unjoined, [
		{ index: 0, area: "E05000001", reason: "duplicate-area" },
		{
			index: 1,
			area: "example ward",
			reason: "duplicate-area",
			sameAreaAs: 0,
		},
	]);
	assert.equal(result.summary.duplicateAreas, 1);
	assert.equal(result.summary.areasWithoutValue, 1);
});

test("answers a join only as a POST, and only for a release it holds", () => {
	assert.equal(route("GET", JOIN, context).status, 405);
	assert.equal(
		post(
			"/v1/boundary-releases/ward/1999-01-en-ward:join",
			json({ rows: [{ area: "E05000001", value: 1 }] }),
		).status,
		404,
	);
	assert.equal(
		post(
			`${JOIN}?format=csv`,
			json({ rows: [{ area: "E05000001", value: 1 }] }),
		).status,
		400,
	);
	// A release with no map resource still gets its join table.
	assert.equal(
		post(
			`${JOIN}?format=geojson`,
			json({ rows: [{ area: "E05000001", value: 1 }] }),
		).status,
		503,
	);
});

test("returns the joined areas as GeoJSON from the stored tier", () => {
	const directory = mkdtempSync(join(tmpdir(), "atlas-join-"));
	const path = join(directory, "ward-low.geojson.gz");
	const feature = (id: number, code: string) => ({
		type: "Feature",
		id,
		properties: { id, code, name: code },
		geometry: { type: "Point", coordinates: [0, id] },
	});
	const content = Buffer.from(
		JSON.stringify({
			type: "FeatureCollection",
			features: [feature(1, "E05000001"), feature(2, "E05000002")],
		}),
	);
	writeFileSync(path, gzipSync(content));
	const resource = {
		id: "ward/2025-01-en-ward",
		tiles: { layer: "areas" },
		attribution: { text: "Source: Example", href: "/v1/attribution" },
		features: [
			{ tier: "low", format: "geojson", artifact: "ward-low.geojson" },
		],
	} as unknown as MapResourceDescriptor;
	const withMap: RouteContext = {
		...context,
		mapResources: { resources: [resource] },
		mapFeatures: new Map([
			[
				"ward-low.geojson",
				{
					path,
					bytes: content.length,
					contentHash: "sha256:fixture",
					gzipBytes: 1,
				},
			],
		]),
	};
	const response = post(
		`${JOIN}?format=geojson&tier=low`,
		json({ rows: [{ area: "E05000002", value: 7 }] }),
		withMap,
	);
	assert.equal(response.status, 200);
	assert.equal(response.representation?.contentType, "application/geo+json");
	const collection = JSON.parse(String(response.representation?.body)) as {
		features: Array<{ id: number; properties: { value: unknown } }>;
		attribution: string;
	};
	assert.deepEqual(
		collection.features.map(({ id, properties }) => [id, properties.value]),
		[[2, 7]],
	);
	assert.equal(collection.attribution, "Source: Example");
	assert.equal(
		data<{ links: { tiles: string } }>(response).links.tiles,
		"/v1/map-resources/ward/2025-01-en-ward/tiles.json",
	);
});

test("gives a POSTed column the same CSV match report as a GET", () => {
	const values = ["E05000001", "Other ward"];
	const query = "geography=ward&release=2025-01-en-ward&format=csv";
	const got = route(
		"GET",
		`/v1/areas:validate?${query}&${values.map((value) => `value=${encodeURIComponent(value)}`).join("&")}`,
		context,
	);
	const posted = post(`/v1/areas:validate?${query}`, json({ values }));
	assert.equal(posted.status, 200);
	assert.match(posted.representation?.contentType ?? "", /text\/csv/);
	assert.equal(posted.representation?.body, got.representation?.body);
});
