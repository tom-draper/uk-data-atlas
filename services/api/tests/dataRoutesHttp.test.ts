import { expect, test } from "vitest";
import { createAreaLookup } from "@uk-data-atlas/areas";
import type {
	CrosswalkArtifact,
	PropertyCrosswalkArtifact,
} from "@uk-data-atlas/relationships";
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
	crosswalkLookup,
	dataCatalog,
	geographyInventory,
	measureCompatibilityInventory,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	testContext,
} from "./routeFixtures";

const wardToAuthority: PropertyCrosswalkArtifact = {
	...containmentCrosswalk,
	id: "ward-to-authority",
	records: [
		{
			source: { code: "E05000001", labels: [] },
			targets: [{ code: "E08000001", labels: [] }],
		},
		{
			source: { code: "W05000001", labels: [] },
			targets: [{ code: "W06000001", labels: [] }],
		},
	],
};

const context = testContext({
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup: new Map<string, CrosswalkArtifact>([
		...crosswalkLookup,
		[wardToAuthority.id, wardToAuthority],
	]),
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations: [
		populationObservations,
		populationLocalAuthorityObservations,
		...measureObservations,
	],
});

const ward = "period=2022&geography=ward&codeYear=2023";
const MEASURE = "population";

/** Each data route, asked in the ways its callers ask. */
const reads = (id: string): CharacterizedRequest[] =>
	[
		`/v1/data/${id}`,
		`/v1/data/${id}?${ward}`,
		`/v1/data/${id}?${ward}&limit=1`,
		`/v1/data/${id}?${ward}&limit=0`,
		`/v1/data/${id}?${ward}&limit=1&cursor=bad`,
		`/v1/data/${id}?${ward}&format=csv`,
		`/v1/data/${id}?${ward}&format=ndjson`,
		`/v1/data/${id}?${ward}&format=parquet`,
		`/v1/data/${id}?${ward}&format=nope`,
		`/v1/data/${id}?${ward}&include=area`,
		`/v1/data/${id}?${ward}&place=E05000001`,
		`/v1/data/${id}?${ward}&place=E05000001&format=csv`,
		`/v1/data/${id}?${ward}&aggregate=sum`,
		`/v1/data/${id}?${ward}&units=canonical`,
		`/v1/data/${id}?${ward}&units=not-a-unit-mode`,
		`/v1/data/${id}?${ward}&release=2023-05-uk-bgc&place=E05000001`,
		`/v1/data/${id}?${ward}&release=2023-12-uk-bgc`,
		`/v1/data/${id}?period=2022&geography=ward&codeYear=2024`,
		`/v1/data/${id}?period=1999&geography=ward&codeYear=2023`,
		`/v1/data/${id}?geography=localAuthority`,
		`/v1/data/${id}?unexpected=1`,
		`/v1/data/${id}/series`,
		`/v1/data/${id}/series?place=N09000001&geography=localAuthority&codeYear=2023`,
		`/v1/data/${id}/series?place=localAuthority/N09000001&codeYear=2023`,
		`/v1/data/${id}/series?place=unknown&geography=localAuthority&codeYear=2023`,
		`/v1/data/${id}/series?place=N09000001&geography=localAuthority&codeYear=2023&release=2023-05-uk-bgc`,
		`/v1/data/${id}/series?place=N09000001&geography=localAuthority`,
		`/v1/data/${id}/rankings`,
		`/v1/data/${id}/rankings?${ward}`,
		`/v1/data/${id}/rankings?${ward}&limit=1`,
		`/v1/data/${id}/rankings?${ward}&order=sideways`,
		`/v1/data/${id}/rankings?${ward}&order=asc`,
		`/v1/data/${id}/rankings?${ward}&release=2023-05-uk-bgc`,
		`/v1/data/${id}/rankings?geography=localAuthority`,
		`/v1/data/${id}/value`,
		`/v1/data/${id}/value?place=Hartlepool`,
		`/v1/data/${id}/value?place=Hartlepool&period=2022`,
		`/v1/data/${id}/value?place=Leeds&period=2022`,
		`/v1/data/${id}/value?place=Atlantis`,
		`/v1/data/${id}/value?place=E05000001&codeYear=1999`,
		`/v1/data/${id}/value?place=N92000002&geography=localAuthority`,
		`/v1/data/${id}/value?place=N09000001&geography=localAuthority&codeYear=2023&period=2024`,
		`/v1/data/${id}/change`,
		`/v1/data/${id}/change?geography=localAuthority`,
		`/v1/data/${id}/change?place=N09000001&geography=localAuthority&codeYear=2023`,
		`/v1/data/${id}/compare`,
		`/v1/data/${id}/compare?geography=localAuthority&baselinePlace=E06000001&comparisonPlace=N09000001`,
		`/v1/data/${id}/compare?${ward}&baselinePlace=E05000001&comparisonPlace=E05000001`,
		`/v1/data/${id}/compare?${ward}&baselinePlace=E05000001&comparisonPlace=W05000001`,
		`/v1/data/${id}/compare?${ward}&baselinePlace=E05000001&comparisonPlace=W05000001&release=2023-05-uk-bgc`,
		`/v1/data/${id}/convert`,
		`/v1/data/${id}/convert?${ward}`,
		`/v1/data/${id}/convert?${ward}&crosswalk=not-published`,
		`/v1/data/${id}/convert?${ward}&crosswalk=${crosswalkArtifact.id}`,
		`/v1/data/${id}/convert?${ward}&crosswalk=${containmentCrosswalk.id}`,
		`/v1/data/${id}/convert?${ward}&crosswalk=${wardToAuthority.id}`,
		`/v1/data/${id}/convert?${ward}&crosswalk=${wardToAuthority.id}&aggregate=sum`,
		`/v1/data/${id}/convert?${ward}&path=ward-to-health-area`,
	].map((path) => ({ path }));

test("data reads keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const requests: CharacterizedRequest[] = [
		...reads(MEASURE),
		{ path: "/v1/data/no-such-measure" },
		{ path: "/v1/data/not-a-measure?period=2024" },
		{ path: "/v1/data/no-such-measure/value?place=Hartlepool" },
		{ path: "/v1/data/no-such-measure/series" },
		{ path: "/v1/data/no-such-measure/rankings" },
		{ path: "/v1/data/no-such-measure/change" },
		{ path: "/v1/data/no-such-measure/compare" },
		{ path: "/v1/data/no-such-measure/convert" },
		{ path: "/v1/data" },
		{ path: "/v1/data/" },
		{ path: `/v1/data/${MEASURE}/` },
		{ path: `/v1/data/${MEASURE}/value/` },
		{ path: `/v1/data/${MEASURE}/extra` },
		{ path: `/v1/data/${MEASURE}/value/extra` },
		{ path: `/v1/Data/${MEASURE}/value?place=Hartlepool` },
		{ path: `/v1/data/${MEASURE.toUpperCase()}/value?place=Hartlepool` },
		{ path: "/v1/data/%E0%A4%A" },
		{ path: "/v1/data/%E0%A4%A/value" },
		{ path: "/v1/data/a.b/value" },
		{ path: "/v1/data/../value" },
		{ path: "/v1/data/bad%20id/value" },
		{ path: `/v1/data/${"x".repeat(150)}` },
		{ path: `/v1/data/${"x".repeat(150)}/value` },
		{ path: `/v1/data/${MEASURE}/value`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}/value?place=Hartlepool`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}?${ward}`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}/series`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}/rankings?${ward}`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}/change`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}/compare`, method: "HEAD" },
		{ path: `/v1/data/${MEASURE}/convert`, method: "HEAD" },
		{
			path: `/v1/data/${MEASURE}/value?place=Hartlepool`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: `/v1/data/${MEASURE}?${ward}`,
			headers: { "accept-encoding": "gzip" },
		},
		{
			path: `/v1/data/${MEASURE}/value?place=Hartlepool`,
			headers: { "if-none-match": '"unknown"' },
		},
		{
			path: `/v1/data/${MEASURE}?${ward}`,
			headers: { accept: "text/csv" },
		},
		{ path: `/v1/data/${MEASURE}/value`, method: "POST", body: "{}" },
		{ path: `/v1/data/${MEASURE}`, method: "POST", body: "{}" },
		{ path: `/v1/data/${MEASURE}/series`, method: "PUT" },
		{ path: `/v1/data/${MEASURE}/rankings`, method: "DELETE" },
		{ path: `/v1/data/${MEASURE}/change`, method: "PATCH" },
		{ path: `/v1/data/${MEASURE}/compare`, method: "POST", body: "{}" },
		{ path: `/v1/data/${MEASURE}/convert`, method: "POST", body: "{}" },
		{
			path: `/v1/data/${MEASURE}/value`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
		{
			path: `/v1/data/${MEASURE}`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

// Names for the two authorities the population fixture carries values for.
const namedAreas = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:named-areas",
		geography: "localAuthority",
		boundaryRelease: "2023-05-uk-bgc-v2",
		codeProperty: "LAD23CD",
		nameProperty: "LAD23NM",
		areas: [
			{ code: "E06000001", name: "Hartlepool" },
			{ code: "N09000001", name: "Antrim and Newtownabbey" },
		],
	},
]);

test("measure values for a place keep their HTTP responses", async (t) => {
	const named = testContext({
		areaLookup: namedAreas,
		dataCatalog,
		measureObservations: [
			populationObservations,
			populationLocalAuthorityObservations,
			...measureObservations,
		],
	});
	const send = await startCharacterization(t, named);
	const value = `/v1/data/${MEASURE}/value`;
	const requests: CharacterizedRequest[] = [
		`${value}?place=Hartlepool`,
		`${value}?place=Hartlepool&period=2022`,
		`${value}?place=Hartlepool&period=2024`,
		`${value}?place=hartlepool`,
		`${value}?place=Antrim%20%26%20Newtownabbey`,
		`${value}?place=N09000001`,
		`${value}?place=N09000001&geography=localAuthority`,
		`${value}?place=localAuthority/N09000001`,
		`${value}?place=localAuthority/N09000001&codeYear=2023&period=2024`,
		`${value}?place=E05000001&${ward}`,
		`${value}?place=E05000001&${ward}&release=2023-05-uk-bgc`,
		`${value}?place=E05000001&${ward}&release=2023-12-uk-bgc`,
		`${value}?place=W05000001&${ward}`,
		`${value}?place=E05999999&${ward}`,
		`${value}?place=Leeds&period=2022`,
		`${value}?place=Atlantis`,
		`${value}?place=`,
		`${value}?place=E05000001&place=W05000001&${ward}`,
		`${value}?place=E05000001&${ward}&unexpected=1`,
		`${value}?place=E05000001&${ward}&format=csv`,
		`${value}?place=E05000001&${ward}&units=canonical`,
		`${value}?place=E05000001&${ward}&units=nope`,
		`${value}?place=E05000001&${ward}&include=area`,
		`${value}?place=E05000001&${ward}&include=nope`,
		`/v1/data/${MEASURE}/change?place=N09000001&geography=localAuthority&codeYear=2023`,
		`/v1/data/${MEASURE}/series?place=N09000001&geography=localAuthority&codeYear=2023`,
	].map((path) => ({ path }));
	requests.push(
		{ path: `${value}?place=Hartlepool`, method: "HEAD" },
		{
			path: `${value}?place=Hartlepool`,
			headers: { "accept-encoding": "gzip" },
		},
		{
			path: `${value}?place=Hartlepool`,
			headers: { "if-none-match": '"unknown"' },
		},
		{
			path: `${value}?place=Hartlepool`,
			headers: { origin: "https://example.test" },
		},
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("data routes answer without the data they read", async (t) => {
	const bare = testContext({ areaLookup });
	const send = await startCharacterization(t, bare);
	const requests: CharacterizedRequest[] = [
		{ path: `/v1/data/${MEASURE}?${ward}` },
		{ path: `/v1/data/${MEASURE}/series?place=N09000001` },
		{ path: `/v1/data/${MEASURE}/rankings?${ward}` },
		{ path: `/v1/data/${MEASURE}/value?place=Hartlepool` },
		{ path: `/v1/data/${MEASURE}/change` },
		{ path: `/v1/data/${MEASURE}/compare` },
		{ path: `/v1/data/${MEASURE}/convert?${ward}` },
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});
