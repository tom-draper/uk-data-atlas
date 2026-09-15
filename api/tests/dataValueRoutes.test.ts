import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import {
	registry,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
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
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup: namedAreas,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
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

	const answered = get("/v1/data/population-estimate/value?place=Hartlepool");
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
		"/v1/data/population-estimate/value?place=Hartlepool&period=2022",
	);
	assert.equal(
		(earlier.body as { data: { answer: { value: number } } }).data.answer
			.value,
		280,
	);

	assert.equal(
		get("/v1/data/population-estimate/value?place=Atlantis").status,
		404,
	);
	assert.equal(get("/v1/data/population-estimate/value").status, 400);
	assert.equal(
		get("/v1/data/no-such-measure/value?place=Hartlepool").status,
		404,
	);
	assert.equal(get("/v1/places").status, 400);
});
