import { expect, test } from "vitest";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
} from "./geographyFixtures";
import { compileRelationshipPaths } from "./pipelineFixtures";
import { registry, testContext } from "./routeFixtures";

const context = testContext({
	boundaryRegistry: registry,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup: new Map([[containmentCrosswalk.id, containmentCrosswalk]]),
	relationshipPathInventory: compileRelationshipPaths(crosswalkInventory),
});
const bare = testContext({ boundaryRegistry: registry, areaLookup });

const conversion =
	"from=ward/2025-01-en-ward&to=localAuthority/2025-01-uk-lad&purpose=membership";
const methods = (path: string): CharacterizedRequest[] => [
	{
		path,
		method: "OPTIONS",
		headers: {
			origin: "https://example.test",
			"access-control-request-method": "GET",
		},
	},
	...["POST", "PUT", "PATCH", "DELETE"].map((method) => ({ path, method })),
];

test("relationships keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({
		path: "/v1/relationships?from=ward/2025-01-en-ward",
	});
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const queries = [
		"from=ward/2025-01-en-ward",
		conversion,
		`${conversion}&operation=containment-aggregation`,
		`${conversion}&operation=identity-join`,
		`${conversion}&operation=other`,
		"from=localAuthority/2025-01-uk-lad&to=ward/2025-01-en-ward&purpose=membership",
		"from=ward/2025-01-en-ward&to=localAuthority/2025-01-uk-lad&purpose=identity",
		"from=ward/2025-01-en-ward&to=localAuthority/2025-01-uk-lad&purpose=apportion",
		"from=ward/2025-01-en-ward&to=localAuthority/2025-01-uk-lad&purpose=other",
		`${conversion}&measure=population`,
		`${conversion}&measure=unknown`,
		`${conversion}&dataset=population`,
		"from=ward",
		"from=ward/2025-01-en-ward&to=ward",
		"from=nowhere/2020&to=ward/2025-01-en-ward",
		"from=ward/2025-01-en-ward&geography=ward&release=2025-01-en-ward",
		"geography=ward&release=2025-01-en-ward",
		"geography=ward&release=2025-01-en-ward&relation=within",
		"geography=ward&release=2025-01-en-ward&relation=contains&limit=5",
		"geography=ward&release=2025-01-en-ward&relation=adjacent",
		"geography=ward&release=2025-01-en-ward&limit=0",
		"geography=ward&release=2025-01-en-ward&limit=101",
		"geography=ward&release=2025-01-en-ward&limit=abc",
		"geography=ward",
		"release=2025-01-en-ward",
		"geography=nowhere&release=2020",
		"",
		"unexpected=1",
		"from=ward/2025-01-en-ward&unexpected=1",
		"from=%E0%A4%A",
		"from=ward/2025-01-en-ward&from=ward/2025-01-en-ward",
		"from=ward%2F2025-01-en-ward",
	];
	const requests: CharacterizedRequest[] = [
		...queries.map((query) => ({ path: `/v1/relationships?${query}` })),
		{ path: "/v1/relationships?from=ward/2025-01-en-ward", method: "HEAD" },
		{
			path: "/v1/relationships?from=ward/2025-01-en-ward",
			headers: { "if-none-match": etag },
		},
		{
			path: `/v1/relationships?${conversion}`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: "/v1/relationships/" },
		{ path: "/v1/relationships/extra" },
		{ path: "/v1/Relationships?from=ward/2025-01-en-ward" },
		{ path: "/v1/relationships%2F" },
		...methods("/v1/relationships?from=ward/2025-01-en-ward"),
		...methods("/v1/relationships"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("relationships answer without the path inventory", async (t) => {
	const send = await startCharacterization(t, bare);
	expect(
		await characterize(send, [
			{ path: "/v1/relationships?from=ward/2025-01-en-ward" },
			{ path: `/v1/relationships?${conversion}` },
			{
				path: "/v1/relationships?geography=ward&release=2025-01-en-ward",
			},
			{ path: "/v1/relationships" },
		]),
	).toMatchSnapshot();
});
