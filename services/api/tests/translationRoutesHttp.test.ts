import { expect, test } from "vitest";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import {
	areaLookup,
	atlasRelease,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog,
	geographyInventory,
	testContext,
} from "./routeFixtures";

const base = {
	atlasRelease,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
};
const context = testContext({ ...base, dataCatalog });
const withoutCatalogue = testContext(base);

const forward =
	"/v1/translations?from=constituency/2010&code=E14000001&to=constituency/2024-07-uk-bgc&purpose=identity";
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

test("translations keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({ path: forward });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		{ path: forward },
		{ path: forward, method: "HEAD" },
		{ path: forward, headers: { "if-none-match": etag } },
		{
			path: forward,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: "/v1/translations?from=constituency/2024-07-uk-bgc&code=E14001001&to=constituency/2010&purpose=identity",
		},
		{
			path: "/v1/translations?from=constituency/2010&code=E14000001&to=constituency/2024-07-uk-bgc&purpose=membership",
		},
		{
			path: "/v1/translations?from=constituency/2010&code=E14000001&to=constituency/2024-07-uk-bgc&purpose=apportion",
		},
		{
			path: "/v1/translations?from=constituency/2010&code=E99999999&to=constituency/2024-07-uk-bgc&purpose=identity",
		},
		{ path: "/v1/translations" },
		{
			path: "/v1/translations?from=constituency/2010&code=E14000001&to=constituency/2024-07-uk-bgc",
		},
		{
			path: "/v1/translations?from=constituency/2010&code=E14000001&to=constituency/2024-07-uk-bgc&purpose=other",
		},
		{
			path: "/v1/translations?from=constituency&code=E14000001&to=constituency/2024-07-uk-bgc&purpose=identity",
		},
		{ path: `${forward}&unexpected=1` },
		{ path: `${forward}&code=E14000002` },
		{
			path: "/v1/translations?from=constituency%2F2010&code=E14000001&to=constituency%2F2024-07-uk-bgc&purpose=identity",
		},
		{
			path: "/v1/translations?from=%E0%A4%A&code=E1&to=a/b&purpose=identity",
		},
		{ path: "/v1/translations/" },
		{ path: `/v1/translations/extra?${forward.split("?")[1]}` },
		{ path: `/v1/Translations?${forward.split("?")[1]}` },
		{ path: `/v1/translations%2F?${forward.split("?")[1]}` },
		...methods(forward),
		...methods("/v1/translations"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

const attributions = [
	"dataset=population",
	"measure=population",
	"measure=population&measure=population",
	"dataset=population&measure=population",
	"boundaryRelease=constituency/2010",
	"crosswalk=constituency-2010-to-2024",
	"dataset=population&boundaryRelease=constituency/2010&crosswalk=constituency-2010-to-2024",
	"dataset=unknown",
	"measure=unknown",
	"boundaryRelease=nowhere/2020",
	"crosswalk=unknown",
	"",
	"unexpected=1",
	"dataset=population&unexpected=1",
	"dataset=%E0%A4%A",
];

test("attribution keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({ path: "/v1/attribution?dataset=population" });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		...attributions.map((query) => ({ path: `/v1/attribution?${query}` })),
		{ path: "/v1/attribution?dataset=population", method: "HEAD" },
		{
			path: "/v1/attribution?dataset=population",
			headers: { "if-none-match": etag },
		},
		{
			path: "/v1/attribution?dataset=population",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: "/v1/attribution" },
		{ path: "/v1/attribution/" },
		{ path: "/v1/attribution/extra?dataset=population" },
		{ path: "/v1/Attribution?dataset=population" },
		...methods("/v1/attribution?dataset=population"),
		...methods("/v1/attribution"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("attribution is unavailable before the catalogue is built", async (t) => {
	const send = await startCharacterization(t, withoutCatalogue);
	expect(
		await characterize(send, [
			{ path: "/v1/attribution?dataset=population" },
			{ path: "/v1/attribution" },
			{ path: "/v1/attribution?dataset=population", method: "HEAD" },
		]),
	).toMatchSnapshot();
});
