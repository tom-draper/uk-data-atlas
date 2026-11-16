import { expect, test } from "vitest";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { areaLookup, registry, testContext } from "./routeFixtures";

const context = testContext({ boundaryRegistry: registry, areaLookup });
const JOIN = "/v1/boundary-releases/ward/2025-01-en-ward:join";

const json = (path: string, value: unknown): CharacterizedRequest => ({
	path,
	method: "POST",
	headers: { "content-type": "application/json" },
	body: typeof value === "string" ? value : JSON.stringify(value),
});
const csv = (path: string, text: string): CharacterizedRequest => ({
	path,
	method: "POST",
	headers: { "content-type": "text/csv" },
	body: text,
});
const rows = {
	rows: [
		{ area: "E05000002", value: 20 },
		{ area: "Example ward", value: 10 },
		{ area: "Nowhere ward", value: 1 },
	],
};

test("a release join keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const requests: CharacterizedRequest[] = [
		json(JOIN, rows),
		{
			...json(JOIN, rows),
			headers: {
				"content-type": "application/json",
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		json(JOIN, { rows: [{ code: "E05000001", value: 1 }] }),
		json(JOIN, {
			rows: [{ name: "Example ward", value: "high", parent: "North" }],
		}),
		json(JOIN, {
			rows: [
				{ area: "E05000001", value: null },
				{ area: "E05000002", value: true },
			],
		}),
		json(JOIN, {
			rows: [
				{ area: "E05000001", value: 1 },
				{ area: "example ward", value: 2 },
			],
		}),
		csv(JOIN, "code,value\nE05000001,1\nE05000002,\n"),
		csv(JOIN, "code,value,parent\nE05000001,12.5,North\n"),
		csv(JOIN, "code\nE05000001\n"),
		csv(JOIN, ""),
		json(JOIN, "{"),
		json(JOIN, { rows: [] }),
		json(JOIN, { rows: [{ area: 7, value: 1 }] }),
		json(JOIN, { rows: [{ area: "E05000001", value: {} }] }),
		json(JOIN, { values: ["E05000001"] }),
		json(JOIN, []),
		{
			path: JOIN,
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "E05000001",
		},
		{
			path: JOIN,
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: '{"rows":[{"area":"E05000001","value":1}]}',
		},
		{
			path: JOIN,
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "code,value\nE05000001,1\n",
		},
		{
			path: JOIN,
			method: "POST",
			body: '{"rows":[{"area":"E05000001","value":1}]}',
		},
		{ path: JOIN, method: "POST" },
		{
			path: JOIN,
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify(rows),
		},
		{
			path: JOIN,
			method: "POST",
			headers: { "content-type": "APPLICATION/JSON" },
			body: JSON.stringify(rows),
		},
		json(`${JOIN}?format=json`, rows),
		json(`${JOIN}?format=geojson`, rows),
		json(`${JOIN}?format=geojson&tier=low`, rows),
		{
			...json(`${JOIN}?format=geojson&tier=full`, rows),
			headers: {
				"content-type": "application/json",
				"x-request-id": "join-geojson-full",
			},
		},
		json(`${JOIN}?format=geojson&tier=other`, rows),
		json(`${JOIN}?format=csv`, rows),
		json(`${JOIN}?tier=high`, rows),
		json(`${JOIN}?unexpected=1`, rows),
		json("/v1/boundary-releases/ward/latest:join", rows),
		json("/v1/boundary-releases/ward/1999-01-en-ward:join", rows),
		json("/v1/boundary-releases/nowhere/2025-01-en-ward:join", rows),
		json("/v1/boundary-releases/ward/:join", rows),
		json("/v1/boundary-releases/ward/2025-01-en-ward%3Ajoin", rows),
		json("/v1/boundary-releases/ward/2025-01-en-ward:join/", rows),
		json("/v1/boundary-releases/ward/2025-01-en-ward:join/extra", rows),
		json("/v1/boundary-releases/ward/2025-01-en-ward:Join", rows),
		json("/v1/Boundary-Releases/ward/2025-01-en-ward:join", rows),
		json("/v1/boundary-releases/ward/2025-01-en-ward:joins", rows),
		json("/v1/boundary-releases/ward/%E0%A4%A:join", rows),
		json(`/v1/boundary-releases/ward/${"x".repeat(150)}:join`, rows),
		{
			path: "/v1/boundary-releases/ward/2025-01-en-ward:join",
			method: "GET",
		},
		{ path: JOIN, method: "HEAD" },
		{
			path: JOIN,
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(rows),
		},
		{
			path: JOIN,
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(rows),
		},
		{ path: JOIN, method: "DELETE" },
		{
			path: JOIN,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "POST",
			},
		},
		{ path: `${JOIN}?format=geojson`, method: "GET" },
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("a release join reads its body under the size limits", async (t) => {
	const send = await startCharacterization(t, context);
	const big = `code,value\n${"E05000001,1\n".repeat(800_000)}`;
	const many = JSON.stringify({
		rows: Array.from({ length: 250_001 }, () => ({
			area: "E05000001",
			value: 1,
		})),
	});
	const out: Record<
		string,
		{ status: number; headers: string[]; body: string }
	> = {};
	for (const [name, request] of [
		["oversize csv", csv(JOIN, big)],
		["oversize json", json(JOIN, many)],
		["after oversize", json(JOIN, rows)],
	] as const) {
		const { status, headers, body } = await send(request);
		out[name] = {
			status,
			headers,
			body: body.length > 600 ? body.slice(0, 600) : body,
		};
	}
	expect(out).toMatchSnapshot();
});
