import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route } from "./routeFixtures";
import { areaLookup, geographyInventory, registry } from "./routeFixtures";

test("resolves an exact code to dossiers without choosing a release", () => {
	const response = route(
		"GET",
		"/v1/areas:resolve?q=e05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		query: { value: "e05000001" },
		candidates: [
			{
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
				matches: ["code-exact"],
				dossierHref: "/v1/areas/ward/2025-01-en-ward/E05000001/dossier",
			},
		],
		search: {
			href: "/v1/areas?q=e05000001",
			note: "Use search for prefix matching when no exact official code, name or supplied alias resolves.",
		},
		note: "Candidates are every exact match within the requested filters. `matches` states whether the identifier matched an official code, name or supplied alias; this endpoint never chooses between geography or boundary-release candidates.",
	});
});

test("resolves an alias exactly and directs prefixes to the search resource", () => {
	const alias = route(
		"GET",
		"/v1/areas:resolve?q=gm&geography=localAuthority",
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
			matches: ["alias-exact"],
			dossierHref:
				"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/dossier",
		},
	]);
	assert.equal(
		aliasData.search.href,
		"/v1/areas?q=gm&geography=localAuthority",
	);

	const prefix = route(
		"GET",
		"/v1/areas:resolve?q=Greater",
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
	assert.equal(prefixData.search.href, "/v1/areas?q=Greater");
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
		"/v1/areas:resolve?q=Example",
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
			{ code: "E08000001", matches: ["alias-exact"] },
			{ code: "E05000001", matches: ["name-exact"] },
		],
	);
});

test("selects a dated release before resolving an exact identifier", () => {
	const response = route(
		"GET",
		"/v1/areas:resolve?q=E05000001&geography=ward&date=2025-02",
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
		"/v1/areas:resolve?q=E05000001&date=2025-02",
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
		"/v1/areas:resolve",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 400);
	assert.equal(
		(response.body as { detail?: string }).detail,
		"q is required: an official area code, name or supplied alias.",
	);
});
