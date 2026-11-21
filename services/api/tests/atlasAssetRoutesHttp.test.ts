import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, expect, test } from "vitest";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { atlasRelease, testContext } from "./routeFixtures";

const directory = mkdtempSync(join(tmpdir(), "atlas-asset-http-"));
const stored = (name: string, json: string) => {
	const gzipped = gzipSync(json);
	const path = join(directory, `${name}.json.gz`);
	writeFileSync(path, gzipped);
	return {
		path,
		bytes: json.length,
		gzipBytes: gzipped.length,
		contentHash: `sha256:${name}`,
	};
};
const built = testContext({
	atlasRelease,
	atlasLookups: new Map([
		[
			"boundary-mappings",
			stored("boundary-mappings", '{"wards":{"E1":"E2"}}'),
		],
		["lsoa-lad-mappings-2021", stored("lsoa", "{}")],
	]),
	atlasPages: new Map([
		["places-index", stored("places-index", '{"places":[]}')],
		["Places-Area-E050001", stored("places-area", "[1,2,3]")],
	]),
});
const empty = testContext({ atlasRelease });

const requestsFor = (kind: "lookups" | "pages", id: string, other: string) => {
	const base = `/v1/atlas-${kind}`;
	const plain = { "accept-encoding": "identity" };
	return (etag: string): CharacterizedRequest[] => [
		{ path: `${base}/${id}.json`, headers: plain },
		{ path: `${base}/${id}.json`, method: "HEAD" },
		{ path: `${base}/${id}.json`, headers: { "if-none-match": etag } },
		{ path: `${base}/${id}.json`, headers: { "accept-encoding": "gzip" } },
		{
			path: `${base}/${id}.json`,
			headers: { origin: "https://example.test" },
		},
		{ path: `${base}/${other}.json` },
		{ path: `${base}/unknown.json` },
		{ path: `${base}/unknown.json`, method: "HEAD" },
		{ path: `${base}/${id}.json?unexpected=1` },
		{ path: `${base}/${id}.json/` },
		{ path: `${base}/${id}` },
		{ path: `${base}/${id}.JSON` },
		{ path: `${base}/.json` },
		{ path: `${base}/..json` },
		{ path: `${base}/${id.toUpperCase()}.json` },
		{
			path: `${base}/%${id.charCodeAt(0).toString(16)}${id.slice(1)}.json`,
		},
		{ path: `${base}/a%2Fb.json` },
		{ path: `${base}/%E0%A4%A.json` },
		{ path: `${base}/${"x".repeat(150)}.json` },
		{ path: `${base}/${id}.json/extra` },
		{ path: base },
		{ path: `${base}/` },
		{
			path: `${base}/${id}.json`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
		...["POST", "PUT", "PATCH", "DELETE"].flatMap((method) => [
			{ path: `${base}/${id}.json`, method },
			{ path: `${base}/unknown.json`, method },
		]),
	];
};

const assets = [
	["lookups", "boundary-mappings", "lsoa-lad-mappings-2021"],
	["pages", "places-index", "Places-Area-E050001"],
] as const;

for (const [kind, id, other] of assets) {
	test(`atlas ${kind} keep their HTTP responses`, async (t) => {
		const send = await startCharacterization(t, built);
		const first = await send({ path: `/v1/atlas-${kind}/${id}.json` });
		const etag =
			first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ??
			"";
		expect(
			await characterize(send, requestsFor(kind, id, other)(etag)),
		).toMatchSnapshot();
	});

	test(`atlas ${kind} answer 503 before they are built`, async (t) => {
		const send = await startCharacterization(t, empty);
		const base = `/v1/atlas-${kind}`;
		expect(
			await characterize(send, [
				{ path: `${base}/anything.json` },
				{ path: `${base}/anything.json`, method: "HEAD" },
			]),
		).toMatchSnapshot();
	});
}

afterAll(() => {
	rmSync(directory, { recursive: true, force: true });
});
