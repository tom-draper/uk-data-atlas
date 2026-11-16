import { expect, test } from "vitest";
import type { PropertyCrosswalkArtifact } from "@uk-data-atlas/relationships";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkArtifact,
	crosswalkInventory,
	registry,
	testContext,
} from "./routeFixtures";

const counts: PropertyCrosswalkArtifact = {
	...containmentCrosswalk,
	id: "test-counts",
	records: [
		{
			source: { code: "E05000001", labels: [] },
			targets: [{ code: "E08000001", labels: [] }],
		},
		{
			source: { code: "E05000002", labels: [] },
			targets: [{ code: "E08000001", labels: [] }],
		},
	],
};
const many: PropertyCrosswalkArtifact = {
	...crosswalkArtifact,
	id: "many-records",
	records: Array.from({ length: 5 }, (_, index) => ({
		source: { code: `E1400${index}`, labels: [`Seat ${index}`] },
		targets: [{ code: `E1500${index}`, labels: [] }],
	})),
};
const context = testContext({
	boundaryRegistry: registry,
	areaLookup,
	crosswalkInventory: {
		...crosswalkInventory,
		crosswalks: [
			...crosswalkInventory.crosswalks,
			{
				...crosswalkInventory.crosswalks[0],
				id: many.id,
				recordCount: many.records.length,
				artifact: `crosswalks/${many.id}.json`,
			},
			{
				...crosswalkInventory.crosswalks[0],
				id: counts.id,
				recordCount: counts.records.length,
				artifact: `crosswalks/${counts.id}.json`,
			},
		],
	},
	crosswalkLookup: new Map([
		[crosswalkArtifact.id, crosswalkArtifact],
		[many.id, many],
		[counts.id, counts],
	]),
});
const CONVERT = "/v1/crosswalks/test-counts:convert";

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
		{ code: "E05000001", value: 12 },
		{ code: "E05000002", value: 30 },
	],
};
const named = { rows: [{ name: "Example ward", value: 30 }] };

test("crosswalk reads keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const id = crosswalkArtifact.id;
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/crosswalks" },
		{ path: "/v1/crosswalks", method: "HEAD" },
		{ path: "/v1/crosswalks?limit=1" },
		{ path: "/v1/crosswalks?limit=1&cursor=nope" },
		{ path: "/v1/crosswalks?limit=0" },
		{ path: "/v1/crosswalks?limit=1000" },
		{ path: "/v1/crosswalks?unexpected=1" },
		{
			path: "/v1/crosswalks",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: "/v1/crosswalks/" },
		{ path: "/v1/Crosswalks" },
		{ path: `/v1/crosswalks/${id}` },
		{ path: `/v1/crosswalks/${id}`, method: "HEAD" },
		{
			path: `/v1/crosswalks/${id}`,
			headers: { "if-none-match": '"unknown"' },
		},
		{ path: `/v1/crosswalks/${id}?unexpected=1` },
		{ path: `/v1/crosswalks/${id}/` },
		{ path: `/v1/crosswalks/${id.toUpperCase()}` },
		{ path: "/v1/crosswalks/nowhere" },
		{ path: "/v1/crosswalks/ward-to-local-authority-2025" },
		{ path: "/v1/crosswalks/bad%20id" },
		{ path: "/v1/crosswalks/%E0%A4%A" },
		{ path: "/v1/crosswalks/a.b" },
		{ path: `/v1/crosswalks/${"x".repeat(150)}` },
		{ path: `/v1/crosswalks/${id}/records` },
		{ path: `/v1/crosswalks/${id}/records`, method: "HEAD" },
		{ path: `/v1/crosswalks/${id}/records/` },
		{ path: `/v1/crosswalks/${id}/records/extra` },
		{ path: "/v1/crosswalks/many-records/records?limit=2" },
		{ path: "/v1/crosswalks/many-records/records?limit=2&cursor=bad" },
		{ path: "/v1/crosswalks/many-records/records?limit=0" },
		{ path: "/v1/crosswalks/many-records/records?limit=9999" },
		{ path: "/v1/crosswalks/many-records/records?source=E14002" },
		{ path: "/v1/crosswalks/many-records/records?source=E14002&limit=1" },
		{ path: "/v1/crosswalks/many-records/records?source=E99999" },
		{ path: "/v1/crosswalks/many-records/records?source=" },
		{ path: "/v1/crosswalks/many-records/records?unexpected=1" },
		{ path: "/v1/crosswalks/nowhere/records" },
		{ path: "/v1/crosswalks/%E0%A4%A/records" },
		{ path: "/v1/crosswalks/test-counts:convert" },
		{ path: "/v1/crosswalks/test-counts:convert?semantics=count" },
		{ path: "/v1/crosswalks/test-counts:convert", method: "HEAD" },
		{ path: "/v1/crosswalks", method: "POST", body: "{}" },
		{ path: "/v1/crosswalks", method: "PUT" },
		{ path: `/v1/crosswalks/${id}`, method: "POST", body: "{}" },
		{ path: `/v1/crosswalks/${id}`, method: "DELETE" },
		{ path: `/v1/crosswalks/${id}/records`, method: "PATCH" },
		{
			path: "/v1/crosswalks",
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
		{
			path: `/v1/crosswalks/${id}/records`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("crosswalk conversion keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const count = `${CONVERT}?semantics=count`;
	const requests: CharacterizedRequest[] = [
		json(count, rows),
		json(count, named),
		csv(count, "code,value\nE05000001,12\nE05000002,30\n"),
		{
			...json(count, rows),
			headers: {
				"content-type": "application/json",
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		csv(count, "code,value\nE05000001,12\nExample ward,30\n"),
		csv(count, "code,value\nE05000001,12\nNowhere,1\n"),
		csv(count, "code\nE05000001\n"),
		csv(count, ""),
		json(count, { rows: [] }),
		json(count, { rows: [{ code: "E05000001", value: "high" }] }),
		json(count, { rows: [{ code: "E05000001", value: -1 }] }),
		json(count, { rows: [{ code: "E05000001", value: 1.5 }] }),
		json(count, { rows: [{ code: 7, value: 1 }] }),
		json(count, { values: [] }),
		json(count, "{"),
		json(count, []),
		json(`${CONVERT}?semantics=rate`, rows),
		json(`${CONVERT}?semantics=share`, rows),
		json(`${CONVERT}?semantics=nonsense`, rows),
		json(CONVERT, rows),
		json(`${count}&weighting=none`, rows),
		json(`${count}&weighting=population`, rows),
		json(`${count}&weighting=nonsense`, rows),
		json(`${count}&unexpected=1`, rows),
		json(`${count}&format=csv`, rows),
		{
			path: count,
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "E05000001",
		},
		{
			path: count,
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "code,value\nE05000001,1\n",
		},
		{ path: count, method: "POST", body: JSON.stringify(rows) },
		{ path: count, method: "POST" },
		{
			path: count,
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify(rows),
		},
		{
			path: count,
			method: "POST",
			headers: { "content-type": "APPLICATION/JSON" },
			body: JSON.stringify(rows),
		},
		json(`/v1/crosswalks/nowhere:convert?semantics=count`, rows),
		json(
			`/v1/crosswalks/${crosswalkArtifact.id}:convert?semantics=count`,
			rows,
		),
		json(
			`/v1/crosswalks/ward-to-local-authority-2025:convert?semantics=count`,
			rows,
		),
		json(`/v1/crosswalks/:convert?semantics=count`, rows),
		json(`/v1/crosswalks/test-counts%3Aconvert?semantics=count`, rows),
		json(`${count}/`.replace("count/", "count"), rows),
		json(`/v1/crosswalks/test-counts:convert/?semantics=count`, rows),
		json(`/v1/crosswalks/test-counts:convert/extra?semantics=count`, rows),
		json(`/v1/crosswalks/test-counts:Convert?semantics=count`, rows),
		json(`/v1/Crosswalks/test-counts:convert?semantics=count`, rows),
		json(`/v1/crosswalks/test-counts:converts?semantics=count`, rows),
		json(`/v1/crosswalks/%E0%A4%A:convert?semantics=count`, rows),
		json(`/v1/crosswalks/${"x".repeat(150)}:convert?semantics=count`, rows),
		{ path: count, method: "GET" },
		{ path: count, method: "HEAD" },
		{
			path: count,
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(rows),
		},
		{ path: count, method: "DELETE" },
		{
			path: count,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "POST",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("crosswalk conversion reads its body under the size limits", async (t) => {
	const send = await startCharacterization(t, context);
	const count = `${CONVERT}?semantics=count`;
	const big = `code,value\n${"E05000001,1\n".repeat(800_000)}`;
	const out: Record<
		string,
		{ status: number; headers: string[]; body: string }
	> = {};
	for (const [name, request] of [
		["oversize csv", csv(count, big)],
		["after oversize", json(count, rows)],
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
