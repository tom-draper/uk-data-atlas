import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route } from "./routeFixtures";
import { areaLookup, geographyInventory, registry } from "./routeFixtures";

test("resolves an exact code in a geography without choosing a release", () => {
	const response = route(
		"GET",
		"/v1/places?q=e05000001&geography=ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		query: { value: "e05000001", geography: "ward" },
		candidates: [
			{
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
				matches: ["code-exact"],
				dossierHref:
					"/v1/areas/ward/2025-01-en-ward/E05000001?include=dossier",
			},
		],
		search: {
			href: "/v1/places?q=e05000001",
			note: "Use place search for prefix matching when no exact official code, name or supplied alias resolves.",
		},
		note: "Candidates are every exact match within the requested filters. `matches` says whether the identifier matched an official code, name or supplied alias, including when accents, punctuation or an administrative title were set aside; this endpoint never chooses between geography or boundary-release candidates.",
	});
});

test("uses places as the front door for a filtered exact area lookup", () => {
	const response = route(
		"GET",
		"/v1/places?q=E05000001&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.candidates.length, 1);
	assert.equal(data.candidates[0].code, "E05000001");
});

test("resolves an alias exactly and directs prefixes to the search resource", () => {
	const alias = route(
		"GET",
		"/v1/places?q=gm&geography=localAuthority",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(alias.status, 200);
	const aliasData = ("data" in alias.body && alias.body.data) as {
		candidates: Array<{ matches: string[]; dossierHref: string }>;
		search: { href: string };
	};
	assert.deepEqual(aliasData.candidates, [
		{
			id: "localAuthority/2025-01-uk-lad/E08000001",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			code: "E08000001",
			name: "Greater Manchester",
			aliases: ["GM"],
			matches: ["exact"],
			dossierHref:
				"/v1/areas/localAuthority/2025-01-uk-lad/E08000001?include=dossier",
		},
	]);
	assert.equal(aliasData.search.href, "/v1/places?q=gm");

	const prefix = route(
		"GET",
		"/v1/places?q=Greater&geography=localAuthority",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(prefix.status, 200);
	const prefixData = ("data" in prefix.body && prefix.body.data) as {
		candidates: unknown[];
		search: { href: string };
	};
	assert.deepEqual(prefixData.candidates, []);
	assert.equal(prefixData.search.href, "/v1/places?q=Greater");
});

test("resolves normalised names and aliases without hiding the matching rule", () => {
	const lookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:normalised-name",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			codeProperty: "LAD25CD",
			nameProperty: "LAD25NM",
			areas: [
				{
					code: "W06000001",
					name: "Bristol, City of",
					aliases: ["Ynys Môn & Vale"],
				},
			],
		},
	]);
	const title = route(
		"GET",
		"/v1/places?q=Bristol&geography=localAuthority",
		registry,
		geographyInventory,
		lookup,
	);
	const alias = route(
		"GET",
		"/v1/places?q=ynys%20mon%20and%20vale&geography=localAuthority",
		registry,
		geographyInventory,
		lookup,
	);
	const matches = (response: typeof title) =>
		(
			("data" in response.body && response.body.data) as {
				candidates: Array<{ matches: string[] }>;
			}
		).candidates[0]?.matches;
	assert.deepEqual(matches(title), ["exact-without-title"]);
	assert.deepEqual(matches(alias), ["exact"]);
});

test("keeps an exact name and another area's equal alias as separate candidates", () => {
	const ambiguousLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:name",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [{ code: "E05000001", name: "Example" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:alias",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			codeProperty: "LAD25CD",
			nameProperty: "LAD25NM",
			areas: [
				{ code: "E08000001", name: "Elsewhere", aliases: ["Example"] },
			],
		},
	]);
	const response = route(
		"GET",
		"/v1/places?q=Example&country=GB-ENG",
		registry,
		geographyInventory,
		ambiguousLookup,
	);
	assert.equal(response.status, 200);
	const data = ("data" in response.body && response.body.data) as {
		candidates: Array<{ code: string; matches: string[] }>;
	};
	assert.deepEqual(
		data.candidates.map(({ code, matches }) => ({ code, matches })),
		[
			{ code: "E08000001", matches: ["exact"] },
			{ code: "E05000001", matches: ["exact"] },
		],
	);
});

test("selects a dated release before resolving an exact identifier", () => {
	const response = route(
		"GET",
		"/v1/places?q=E05000001&geography=ward&date=2025-02",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	const data = ("data" in response.body && response.body.data) as {
		query: { value: string; geography: string; boundaryRelease: string };
		selection: {
			policy: string;
			date: string;
			selected: { id: string };
			sameMonth: boolean;
		};
	};
	assert.deepEqual(data.query, {
		value: "E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
	});
	assert.deepEqual(data.selection, {
		policy: "latest-release-dated-on-or-before",
		date: "2025-02",
		selected: {
			id: "2025-01-en-ward",
			month: "2025-01",
			title: "Ward boundaries",
			countries: ["GB-ENG"],
			href: "/v1/boundary-releases/ward/2025-01-en-ward",
		},
		sameMonth: false,
		previous: null,
		next: null,
		setAside: [],
		notCovering: [],
		note: "Releases are snapshots dated to a month. The selected release is the latest dated on or before the requested date, not a claim about which boundaries were legally in force that day.",
	});
});

test("requires an explicit geography when resolving an identifier by date", () => {
	const response = route(
		"GET",
		"/v1/places?q=E05000001&date=2025-02",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 400);
	assert.equal(
		(response.body as { detail?: string }).detail,
		"geography is required when resolving an area identifier by date.",
	);
});

test("requires an identifier before resolving area candidates", () => {
	const response = route(
		"GET",
		"/v1/places?geography=ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 400);
	assert.equal(
		(response.body as { detail?: string }).detail,
		"q is required: a place name, an area code, or a place reference such as localAuthority/E08000003.",
	);
});
