import { expect, test } from "vitest";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/relationships";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { testContext } from "./routeFixtures";

const inventory: AnalysisGeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:analysis-geographies",
	dataCatalogHash: "sha256:data-catalog",
	crosswalkInventoryHash: "sha256:crosswalk-inventory",
	supports: [
		{
			measureId: "road-collisions",
			analysisGeography: {
				geography: "localAuthority",
				boundaryRelease: "2023-05-uk-bgc-v2",
			},
			source: {
				datasetId: "road-collisions",
				geography: "lsoa",
				boundaryYear: 2021,
				periods: ["2024", "2025"],
			},
			crosswalk: {
				id: "lsoa-2021-to-local-authority-2023",
				method: "clean-containment",
				quality: "publisher-supplied",
			},
			note: "Exact regrouping.",
		},
	],
};

const context = testContext({ analysisGeographyInventory: inventory });
const without = testContext({});

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

const plan =
	"/v1/analysis:plan?measure=road-collisions&to=localAuthority/2023-05-uk-bgc-v2&geography=lsoa&codeYear=2021";

test("analysis geographies keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({ path: "/v1/analysis-geographies" });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/analysis-geographies" },
		{ path: "/v1/analysis-geographies", method: "HEAD" },
		{
			path: "/v1/analysis-geographies",
			headers: { "if-none-match": etag },
		},
		{
			path: "/v1/analysis-geographies",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: "/v1/analysis-geographies?measure=road-collisions" },
		{ path: "/v1/analysis-geographies?measure=unknown" },
		{ path: "/v1/analysis-geographies?measure=population" },
		{ path: "/v1/analysis-geographies?measure=road-collisions&offence=x" },
		{ path: "/v1/analysis-geographies?dataset=road-collisions" },
		{ path: "/v1/analysis-geographies?dataset=population" },
		{ path: "/v1/analysis-geographies?unexpected=1" },
		{ path: "/v1/analysis-geographies?measure=%E0%A4%A" },
		{ path: "/v1/analysis-geographies?measure=a&measure=b" },
		{ path: "/v1/analysis-geographies/" },
		{ path: "/v1/analysis-geographies/extra" },
		{ path: "/v1/Analysis-Geographies" },
		...methods("/v1/analysis-geographies"),
		...methods("/v1/analysis-geographies?measure=road-collisions"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("analysis plans keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const available = `${plan}&period=2025`;
	const first = await send({ path: available });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		{ path: available },
		{ path: available, method: "HEAD" },
		{ path: available, headers: { "if-none-match": etag } },
		{
			path: available,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: `${plan}&period=2023` },
		{
			path: "/v1/analysis:plan?measure=road-collisions&period=2025&to=localAuthority/2023-05-uk-bgc-v2",
		},
		{ path: "/v1/analysis:plan" },
		{
			path: "/v1/analysis:plan?measure=unknown&period=2025&to=a/b&geography=lsoa&codeYear=2021",
		},
		{ path: `${available}&unexpected=1` },
		{ path: `${available}&codeYear=abc` },
		{ path: `${available}&period=2024` },
		{ path: available.replace("2021", "2019") },
		{ path: "/v1/analysis:plan?measure=%E0%A4%A&period=2025" },
		{ path: `${available}&dataset=road-collisions` },
		{ path: `${available}&offence=x` },
		{ path: `/v1/analysis%3Aplan?${available.split("?")[1]}` },
		{ path: `/v1/analysis:plan/?${available.split("?")[1]}` },
		{ path: `/v1/Analysis:plan?${available.split("?")[1]}` },
		{ path: `/v1/analysis:plan/extra?${available.split("?")[1]}` },
		{ path: "/v1/analysis" },
		...methods(available),
		...methods("/v1/analysis:plan"),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("analysis routes are unavailable before the inventory is built", async (t) => {
	const send = await startCharacterization(t, without);
	expect(
		await characterize(send, [
			{ path: "/v1/analysis-geographies" },
			{ path: "/v1/analysis-geographies?measure=road-collisions" },
			{ path: `${plan}&period=2025` },
			{ path: "/v1/analysis:plan" },
		]),
	).toMatchSnapshot();
});
