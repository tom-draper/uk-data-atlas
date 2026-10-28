import assert from "node:assert/strict";
import test from "node:test";
import type { BoundaryReleaseDeprecation } from "@uk-data-atlas/catalogue";
import { createAreaLookup } from "../src/areaInventory";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { releaseInPath, withReleaseHeaders } from "../src/releaseDeprecation";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/api";
import { testContext } from "./routeFixtures";

const base = {
	title: "LSOA boundaries",
	coverage: { countries: ["GB-ENG", "GB-WLS"] },
	source: {
		publisher: "ONS",
		url: "https://example.com/source",
		licence: { name: "Open Government Licence" },
	},
	metadataHash: "sha256:metadata",
};

const deprecation: BoundaryReleaseDeprecation = {
	deprecated: "2026-10-26",
	replacedBy: "2001-12-ew-bgc-v2",
	reason: "Thinned; use the unthinned import.",
};

const registryWith = (
	record: BoundaryReleaseDeprecation,
): BoundaryRegistry => ({
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		{
			...base,
			id: "2001-12-ew-bgc",
			geography: "lsoa",
			deprecation: record,
		},
		{ ...base, id: "2001-12-ew-bgc-v2", geography: "lsoa" },
		{ ...base, id: "2011-12-ew-bgc", geography: "lsoa" },
	],
});

const area = (boundaryRelease: string) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${boundaryRelease}`,
	geography: "lsoa",
	boundaryRelease,
	codeProperty: "LSOA01CD",
	nameProperty: "LSOA01NM",
	areas: [{ code: "E01000001", name: "Example LSOA" }],
});

const contextFor = (boundaryRegistry: BoundaryRegistry): RouteContext => ({
	...testContext({
		boundaryRegistry,
		areaLookup: createAreaLookup([
			area("2001-12-ew-bgc"),
			area("2001-12-ew-bgc-v2"),
			area("2011-12-ew-bgc"),
		]),
	}),
	mapResources: {
		resources: [],
		unavailable: ["2001-12-ew-bgc", "2001-12-ew-bgc-v2"].map((release) => ({
			geography: "lsoa",
			boundaryRelease: release,
			reason: "Not a coverage.",
			features: [
				{
					tier: "full",
					format: "geoparquet-1.1",
					href: `/v1/map-resources/lsoa/${release}/features?tier=full`,
					bytes: 4,
					contentHash: "sha256:00",
				},
			] as never,
		})),
	},
	fullDetailDownloads: {
		get: () => ({ status: "built", body: Buffer.from("PAR1") }),
	},
});

const successor = `</v1/boundary-releases/lsoa/2001-12-ew-bgc-v2>; rel="successor-version"`;
const since = `@${Date.parse("2026-10-26") / 1000}`;
const sunset = new Date("2027-04-01").toUTCString();
const get = (url: string, record = deprecation) =>
	routeRequest("GET", url, contextFor(registryWith(record)));

const DEPRECATED_URLS = [
	"/v1/boundary-releases/lsoa/2001-12-ew-bgc",
	"/v1/areas/lsoa/2001-12-ew-bgc/E01000001",
	"/v1/map-resources/lsoa/2001-12-ew-bgc/features?tier=full",
];

for (const url of DEPRECATED_URLS) {
	test(`${url} announces the deprecation`, () => {
		const response = get(url);
		assert.equal(response.status, 200);
		assert.equal(response.headers?.deprecation, since);
		assert.equal(response.headers?.sunset, undefined);
		assert.equal(response.headers?.link, successor);
	});

	test(`${url} announces the sunset date when there is one`, () => {
		const response = get(url, { ...deprecation, sunset: "2027-04-01" });
		assert.equal(response.headers?.deprecation, since);
		assert.equal(response.headers?.sunset, sunset);
	});

	test(`${url.replace("2001-12-ew-bgc", "2001-12-ew-bgc-v2")} is unaffected`, () => {
		const response = get(
			url.replace("2001-12-ew-bgc", "2001-12-ew-bgc-v2"),
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers?.deprecation, undefined);
		assert.equal(response.headers?.sunset, undefined);
		assert.equal(response.headers?.link, undefined);
	});
}

test("a deprecated release's resource carries the record in its body", () => {
	const record = { ...deprecation, sunset: "2027-04-01" };
	const data = (
		get("/v1/boundary-releases/lsoa/2001-12-ew-bgc", record).body as {
			data: { deprecation?: unknown };
		}
	).data;
	assert.deepEqual(data.deprecation, record);
	const current = (
		get("/v1/boundary-releases/lsoa/2001-12-ew-bgc-v2").body as {
			data: { deprecation?: unknown };
		}
	).data;
	assert.equal("deprecation" in current, false);
});

test("the release list marks only the deprecated release", () => {
	const releases = (
		get("/v1/boundary-releases").body as {
			data: Array<{ id: string; deprecation?: unknown }>;
		}
	).data;
	assert.deepEqual(
		releases.map(({ id, deprecation: record }) => [
			id,
			record !== undefined,
		]),
		[
			["2001-12-ew-bgc", true],
			["2001-12-ew-bgc-v2", false],
			["2011-12-ew-bgc", false],
		],
	);
});

test("a release in a deprecated release's path is recognised in every form", () => {
	const named = { geography: "lsoa", release: "2001-12-ew-bgc" };
	for (const path of [
		"/v1/boundary-releases/lsoa/2001-12-ew-bgc",
		"/v1/boundary-releases/lsoa/2001-12-ew-bgc:join",
		"/v1/map-resources/lsoa/2001-12-ew-bgc.pmtiles",
		"/v1/map-resources/lsoa/2001-12-ew-bgc/tiles/1/0/0.mvt",
		"/v1/areas/lsoa/2001-12-ew-bgc/E01000001/geometry",
	])
		assert.deepEqual(releaseInPath(path.split("/").slice(1)), named, path);
	assert.equal(releaseInPath(["v1", "areas"]), undefined);
	assert.equal(releaseInPath(["v1", "measures", "a", "b"]), undefined);
});

test("a response's own Link header is kept beside the successor", () => {
	const release = registryWith(deprecation).releases[0];
	const response = withReleaseHeaders(
		{
			status: 200,
			body: { type: "", title: "", status: 200, detail: "" },
			headers: { link: '</v1/next>; rel="next"' },
		},
		release,
	);
	assert.equal(
		response.headers?.link,
		`</v1/next>; rel="next", ${successor}`,
	);
	assert.equal(response.headers?.deprecation, since);
});

test("resolving a date skips a deprecated release its replacement supersedes", () => {
	const resolved = get(
		"/v1/boundary-releases:resolve?geography=lsoa&date=2002-03-01",
	);
	assert.equal(resolved.status, 200);
	const data = (
		resolved.body as {
			data: { selected: { id: string }; setAside: Array<{ id: string }> };
		}
	).data;
	assert.equal(data.selected.id, "2001-12-ew-bgc-v2");
	assert.deepEqual(
		data.setAside.map(({ id }) => id),
		["2001-12-ew-bgc"],
	);
	assert.equal(resolved.headers?.deprecation, undefined);
});

test("the latest release alias never lands on a deprecated release", () => {
	const response = get("/v1/areas/lsoa/latest/E01000001");
	assert.equal(response.status, 200);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/areas/lsoa/2011-12-ew-bgc/E01000001",
	);
	assert.equal(response.headers?.deprecation, undefined);
});

test("a deprecated release is still resolved where its replacement does not yet apply", () => {
	const registry = registryWith({
		...deprecation,
		replacedBy: "2002-06-ew-bgc-v2",
	});
	registry.releases[1] = {
		...base,
		id: "2002-06-ew-bgc-v2",
		geography: "lsoa",
	};
	const resolve = (date: string) =>
		routeRequest(
			"GET",
			`/v1/boundary-releases:resolve?geography=lsoa&date=${date}`,
			contextFor(registry),
		);
	const early = resolve("2002-03-01");
	assert.equal(
		(early.body as { data: { selected: { id: string } } }).data.selected.id,
		"2001-12-ew-bgc",
	);
	assert.equal(early.headers?.deprecation, since);
	assert.equal(
		early.headers?.link,
		successor.replace("2001-12-ew-bgc-v2", "2002-06-ew-bgc-v2"),
	);
	assert.equal(
		(resolve("2002-07-01").body as { data: { selected: { id: string } } })
			.data.selected.id,
		"2002-06-ew-bgc-v2",
	);
});

test("a deprecated release is still resolved for a country its replacement does not cover", () => {
	const walesOnly: BoundaryRegistry = registryWith(deprecation);
	walesOnly.releases[1]!.coverage = { countries: ["GB-WLS"] };
	const response = routeRequest(
		"GET",
		"/v1/boundary-releases:resolve?geography=lsoa&date=2002-03-01&country=GB-ENG",
		contextFor(walesOnly),
	);
	assert.equal(
		(response.body as { data: { selected: { id: string } } }).data.selected
			.id,
		"2001-12-ew-bgc",
	);
	assert.equal(response.headers?.deprecation, since);
});
