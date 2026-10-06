import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route as routeRequest } from "../src/routes";
import {
	dataCatalog,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	registry,
	testContext,
} from "./routeFixtures";

test("answers a measure for a place named in words", () => {
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
	const context = testContext({
		boundaryRegistry: registry,
		areaLookup: namedAreas,
		dataCatalog,
		measureObservations: [
			populationObservations,
			populationLocalAuthorityObservations,
			...measureObservations,
		],
	});
	const get = (url: string) => routeRequest("GET", url, context);

	const places = get("/v1/places?q=antrim%20%26%20newtownabbey");
	assert.equal(places.status, 200);
	const candidates = (
		places.body as { data: { candidates: { place: string }[] } }
	).data.candidates;
	assert.deepEqual(
		candidates.map((candidate) => candidate.place),
		["localAuthority/N09000001"],
	);

	const answered = get("/v1/data/population/value?place=Hartlepool");
	assert.equal(
		answered.status,
		200,
		JSON.stringify(answered.body).slice(0, 300),
	);
	const data = (
		answered.body as {
			data: {
				answer: {
					value: number;
					unit: string;
					period: string;
					periodDefaulted: boolean;
				};
				place: { place: string };
				method: string;
				via: string;
				note: string;
			};
		}
	).data;
	// No period asked for, so the latest the partition publishes.
	assert.deepEqual(
		[data.answer.value, data.answer.unit, data.answer.period],
		[300, "people", "2024"],
	);
	assert.equal(data.answer.periodDefaulted, true);
	assert.match(data.note, /latest published, 2024/);
	assert.equal(data.place.place, "localAuthority/E06000001");
	assert.equal(data.method, "source-exact");
	// The route that gives the answer directly is named, and gives the same one.
	const direct = get(data.via);
	assert.equal(direct.status, 200);

	const earlier = get(
		"/v1/data/population/value?place=Hartlepool&period=2022",
	);
	assert.equal(
		(earlier.body as { data: { answer: { value: number } } }).data.answer
			.value,
		280,
	);

	assert.equal(get("/v1/data/population/value?place=Atlantis").status, 404);
	assert.equal(get("/v1/data/population/value").status, 400);
	assert.equal(
		get("/v1/data/no-such-measure/value?place=Hartlepool").status,
		404,
	);
	assert.equal(get("/v1/places").status, 400);
});

test("defaults an ambiguous place name and reports its other meanings", () => {
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:local-authorities",
			geography: "localAuthority",
			boundaryRelease: "2023-05-uk-bgc-v2",
			codeProperty: "LAD23CD",
			nameProperty: "LAD23NM",
			areas: [{ code: "E06000001", name: "Leeds" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:wards",
			geography: "ward",
			boundaryRelease: "2023-05-uk-bgc",
			codeProperty: "WD23CD",
			nameProperty: "WD23NM",
			areas: [{ code: "E05000001", name: "Leeds" }],
		},
	]);
	const context = testContext({
		boundaryRegistry: registry,
		areaLookup,
		dataCatalog,
		measureObservations: [
			populationObservations,
			populationLocalAuthorityObservations,
			...measureObservations,
		],
	});
	const response = routeRequest(
		"GET",
		"/v1/data/population/value?place=Leeds&period=2022",
		context,
	);
	assert.equal(response.status, 200, JSON.stringify(response.body));
	const data = response.body as {
		data: {
			question: { placeDefaulted: boolean };
			place: { place: string };
			answer: { value: number };
			otherMatches: Array<{ place: string; answer?: { value: number } }>;
			note: string;
		};
	};
	assert.equal(data.data.question.placeDefaulted, true);
	assert.equal(data.data.place.place, "localAuthority/E06000001");
	assert.equal(data.data.answer.value, 280);
	assert.deepEqual(
		data.data.otherMatches.map((match) => [
			match.place,
			match.answer?.value,
		]),
		[["ward/E05000001", 100]],
	);
	assert.match(data.data.note, /localAuthority was used as the most likely/);
});
