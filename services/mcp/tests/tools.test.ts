import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	boundaryReleases,
	convertCode,
	findMeasures,
	findPlace,
	getArea,
	getSeries,
	getValue,
	locate,
} from "../src/tools.ts";
import { envelope, jsonOf, mockApi, params, textOf } from "./helpers.ts";

describe("find_place", () => {
	it("searches /places and keeps the candidates untouched", async () => {
		const data = {
			query: "Newport",
			candidates: [{ place: "localAuthority/W06000022", match: "exact" }],
		};
		const { client, requests } = mockApi({ body: envelope(data) });
		const result = await findPlace.run({ q: "Newport", limit: 5 }, client);
		assert.equal(requests[0]!.url.pathname, "/v1/places");
		assert.deepEqual(params(requests[0]!), { q: "Newport", limit: "5" });
		assert.equal(requests[0]!.init?.method, "GET");
		const out = jsonOf(result);
		assert.deepEqual(out.data, data);
		assert.equal(out.atlasRelease, "sha256:abc");
		assert.match(out.request, /\/places\?q=Newport&limit=5$/);
		assert.equal(result.isError, undefined);
	});
});

describe("get_value", () => {
	it("maps the measure into the path and keeps defaults and method", async () => {
		const data = {
			question: { place: "North Wales", placeDefaulted: false },
			answer: { period: "2024", periodDefaulted: true, value: 697115 },
			method: "aggregate",
			otherMatches: [{ place: "region/W92000004" }],
		};
		const { client, requests } = mockApi({ body: envelope(data) });
		const result = await getValue.run(
			{ measure: "population", place: "north wales" },
			client,
		);
		assert.equal(requests[0]!.url.pathname, "/v1/data/population/value");
		assert.deepEqual(params(requests[0]!), { place: "north wales" });
		assert.deepEqual(jsonOf(result).data, data);
	});

	it("passes every optional parameter and encodes the measure", async () => {
		const { client, requests } = mockApi();
		await getValue.run(
			{
				measure: "house prices/../x",
				postcode: "SW1A 1AA",
				period: "2022",
				geography: "lsoa",
				codeYear: "2021",
			},
			client,
		);
		assert.equal(
			requests[0]!.url.pathname,
			"/v1/data/house%20prices%2F..%2Fx/value",
		);
		assert.deepEqual(params(requests[0]!), {
			postcode: "SW1A 1AA",
			period: "2022",
			geography: "lsoa",
			codeYear: "2021",
		});
	});

	it("needs a place or a postcode, without calling the API", async () => {
		const { client, requests } = mockApi();
		const result = await getValue.run({ measure: "population" }, client);
		assert.equal(result.isError, true);
		assert.equal(requests.length, 0);
	});

	it("turns a 409 into the choices and an instruction not to guess", async () => {
		const choices = [
			{ place: "localAuthority/W06000022", name: "Newport" },
			{ place: "localAuthority/E06000046", name: "Newport" },
		];
		const { client } = mockApi({
			status: 409,
			body: {
				type: "x",
				title: "Ambiguous place",
				status: 409,
				detail: "Newport means several places.",
				code: "ambiguous_place",
				choices,
			},
		});
		const result = await getValue.run(
			{ measure: "population", place: "Newport" },
			client,
		);
		assert.equal(result.isError, true);
		const text = textOf(result);
		assert.match(text, /409/);
		assert.match(text, /localAuthority\/W06000022/);
		assert.match(text, /localAuthority\/E06000046/);
		assert.match(text, /ambiguous/i);
		assert.match(text, /place reference/);
	});

	it("explains a 404", async () => {
		const { client } = mockApi({
			status: 404,
			body: {
				title: "Not found",
				status: 404,
				detail: "No place is called Atlantis.",
			},
		});
		const result = await getValue.run(
			{ measure: "population", place: "Atlantis" },
			client,
		);
		assert.equal(result.isError, true);
		assert.match(textOf(result), /No place is called Atlantis/);
		assert.match(textOf(result), /find_place/);
	});

	it("reports a 422 with its candidates", async () => {
		const { client } = mockApi({
			status: 422,
			body: {
				title: "Place not served",
				status: 422,
				detail: "no",
				code: "place_not_served",
				candidates: [
					{
						place: "region/E12000002",
						reason: "not published for region",
					},
				],
			},
		});
		const result = await getValue.run(
			{ measure: "house-price-median", place: "North West" },
			client,
		);
		assert.match(textOf(result), /not published for region/);
		assert.match(textOf(result), /rather than estimating/);
	});

	it("reports a 429 with how long to wait", async () => {
		const { client } = mockApi({
			status: 429,
			headers: { "retry-after": "7" },
			body: {
				title: "Too Many Requests",
				status: 429,
				detail: "Slow down.",
			},
		});
		const result = await getValue.run(
			{ measure: "population", place: "Leeds" },
			client,
		);
		assert.equal(result.isError, true);
		assert.match(textOf(result), /429/);
		assert.match(textOf(result), /Wait 7 seconds/);
	});
});

describe("get_series", () => {
	it("maps to the series route and keeps `defaults`", async () => {
		const data = {
			defaults: { geography: "localAuthority", codeYear: 2023 },
			observations: [],
		};
		const { client, requests } = mockApi({ body: envelope(data) });
		const result = await getSeries.run(
			{
				measure: "population",
				place: "localAuthority/E08000025",
				codeYear: 2023,
				datasetId: "ds",
			},
			client,
		);
		assert.equal(requests[0]!.url.pathname, "/v1/data/population/series");
		assert.deepEqual(params(requests[0]!), {
			place: "localAuthority/E08000025",
			codeYear: "2023",
			datasetId: "ds",
		});
		assert.deepEqual(jsonOf(result).data.defaults, data.defaults);
	});
});

describe("find_measures", () => {
	it("searches with q", async () => {
		const { client, requests } = mockApi();
		await findMeasures.run({ q: "house prices" }, client);
		assert.equal(requests[0]!.url.pathname, "/v1/measures");
		assert.deepEqual(params(requests[0]!), { q: "house prices" });
	});

	it("lists everything without q", async () => {
		const { client, requests } = mockApi();
		await findMeasures.run({}, client);
		assert.equal(requests[0]!.url.search, "");
	});
});

describe("locate", () => {
	it("looks a postcode up through /postcodes", async () => {
		const { client, requests } = mockApi();
		await locate.run(
			{
				postcode: "SW1A 1AA",
				geography: ["ward", "lsoa"],
				date: "2024-05",
			},
			client,
		);
		assert.equal(requests[0]!.url.pathname, "/v1/postcodes/SW1A%201AA");
		assert.deepEqual(params(requests[0]!), {
			geography: "ward,lsoa",
			date: "2024-05",
		});
	});

	it("tests a coordinate through /areas:contains", async () => {
		const { client, requests } = mockApi();
		await locate.run({ lat: 51.5, lng: -0.12 }, client);
		assert.equal(requests[0]!.url.pathname, "/v1/areas:contains");
		assert.deepEqual(params(requests[0]!), { lat: "51.5", lng: "-0.12" });
	});

	it("tests a grid reference in British National Grid", async () => {
		const { client, requests } = mockApi();
		await locate.run({ gridref: "TQ 30000 80000" }, client);
		assert.deepEqual(params(requests[0]!), {
			crs: "EPSG:27700",
			gridref: "TQ 30000 80000",
		});
	});

	it("tests an easting and northing", async () => {
		const { client, requests } = mockApi();
		await locate.run({ easting: 530000, northing: 180000 }, client);
		assert.deepEqual(params(requests[0]!), {
			crs: "EPSG:27700",
			easting: "530000",
			northing: "180000",
		});
	});

	it("refuses missing, mixed or half-given input without calling the API", async () => {
		const { client, requests } = mockApi();
		for (const args of [
			{},
			{ postcode: "SW1A 1AA", lat: 1, lng: 1 },
			{ lat: 51 },
			{ easting: 1 },
		]) {
			const result = await locate.run(args, client);
			assert.equal(result.isError, true, JSON.stringify(args));
		}
		assert.equal(requests.length, 0);
	});

	it("explains a postcode that does not exist", async () => {
		const { client } = mockApi({
			status: 404,
			body: {
				title: "Not found",
				status: 404,
				detail: "No such postcode.",
			},
		});
		const result = await locate.run({ postcode: "ZZ99 9ZZ" }, client);
		assert.equal(result.isError, true);
		assert.match(textOf(result), /No such postcode/);
	});
});

describe("get_area", () => {
	it("defaults to the latest release and the area itself", async () => {
		const { client, requests } = mockApi();
		await getArea.run(
			{
				geography: "localAuthority",
				code: "E06000023",
				release: "latest",
				view: "identity",
			},
			client,
		);
		assert.equal(
			requests[0]!.url.pathname,
			"/v1/areas/localAuthority/latest/E06000023",
		);
		assert.equal(requests[0]!.url.search, "");
	});

	it("asks for citation on the area itself", async () => {
		const { client, requests } = mockApi();
		await getArea.run(
			{
				geography: "ward",
				code: "E05000932",
				release: "2024-07-uk-bgc",
				view: "identity",
				include: ["citation", "metrics"],
			},
			client,
		);
		assert.deepEqual(params(requests[0]!), { include: "citation,metrics" });
	});

	it("maps each relation to its route and only sends parameters it takes", async () => {
		const { client, requests } = mockApi();
		const base = {
			geography: "localAuthority",
			code: "E08000003",
			release: "2025-12-uk-bgc",
		} as const;
		await getArea.run(
			{
				...base,
				view: "history",
				depth: 2,
				childGeography: "ward",
				include: ["metrics"],
			},
			client,
		);
		await getArea.run({ ...base, view: "parents" }, client);
		await getArea.run(
			{ ...base, view: "children", childGeography: "ward", depth: 1 },
			client,
		);
		assert.deepEqual(
			requests.map((request) => request.url.pathname),
			[
				"/v1/areas/localAuthority/2025-12-uk-bgc/E08000003/history",
				"/v1/areas/localAuthority/2025-12-uk-bgc/E08000003/parents",
				"/v1/areas/localAuthority/2025-12-uk-bgc/E08000003/children",
			],
		);
		assert.deepEqual(params(requests[0]!), { depth: "2" });
		assert.deepEqual(params(requests[1]!), {});
		assert.deepEqual(params(requests[2]!), {
			depth: "1",
			childGeography: "ward",
		});
	});

	it("reports an area missing from a release", async () => {
		const { client } = mockApi({
			status: 404,
			body: {
				title: "Not found",
				status: 404,
				code: "area_not_in_release",
				detail: "Release holds no such code.",
			},
		});
		const result = await getArea.run(
			{
				geography: "ward",
				code: "X",
				release: "latest",
				view: "identity",
			},
			client,
		);
		assert.match(textOf(result), /area_not_in_release/);
	});
});

describe("convert_code", () => {
	it("maps from, code, to and purpose onto /translations", async () => {
		const { client, requests } = mockApi();
		await convertCode.run(
			{
				from: "ward/2019-12-uk-bgc",
				code: "E05000001",
				to: "ward/2024-12-uk-bgc",
				purpose: "apportion",
			},
			client,
		);
		assert.equal(requests[0]!.url.pathname, "/v1/translations");
		assert.deepEqual(params(requests[0]!), {
			from: "ward/2019-12-uk-bgc",
			code: "E05000001",
			to: "ward/2024-12-uk-bgc",
			purpose: "apportion",
		});
	});

	it("reports a conversion the archive cannot make", async () => {
		const { client } = mockApi({
			status: 422,
			body: {
				title: "Unprocessable",
				status: 422,
				code: "conversion_not_available",
				detail: "No published path.",
			},
		});
		const result = await convertCode.run(
			{ from: "a/b", code: "c", to: "d/e" },
			client,
		);
		assert.equal(result.isError, true);
		assert.match(textOf(result), /conversion_not_available/);
		assert.match(textOf(result), /No published path/);
	});
});

describe("boundary_releases", () => {
	const release = {
		id: "2024-07-uk-bgc",
		geography: "constituency",
		downloads: {
			status: "available",
			pmtiles:
				"/v1/boundary-releases/constituency/2024-07-uk-bgc.pmtiles",
			geojson: {
				medium: "/v1/boundary-releases/constituency/2024-07-uk-bgc.geojson?tier=medium",
			},
		},
	};

	it("returns one release with absolute download links", async () => {
		const { client, requests } = mockApi({ body: envelope(release) });
		const out = jsonOf(
			await boundaryReleases.run(
				{ geography: "constituency", release: "2024-07-uk-bgc" },
				client,
			),
		);
		assert.equal(
			requests[0]!.url.pathname,
			"/v1/boundary-releases/constituency/2024-07-uk-bgc",
		);
		assert.equal(
			out.data.downloads.pmtiles,
			"https://api.test/v1/boundary-releases/constituency/2024-07-uk-bgc.pmtiles",
		);
		assert.match(
			out.data.downloads.geojson.medium,
			/^https:\/\/api\.test\//,
		);
		assert.equal(out.data.downloads.status, "available");
	});

	it("resolves a release for a date", async () => {
		const { client, requests } = mockApi();
		await boundaryReleases.run(
			{ geography: "ward", date: "2019-06", country: "GB-WLS" },
			client,
		);
		assert.equal(
			requests[0]!.url.pathname,
			"/v1/boundary-releases:resolve",
		);
		assert.deepEqual(params(requests[0]!), {
			geography: "ward",
			date: "2019-06",
			country: "GB-WLS",
		});
	});

	it("lists every release, or one geography's", async () => {
		const data = [
			{ id: "a", geography: "ward" },
			{ id: "b", geography: "lsoa" },
		];
		const { client, requests } = mockApi({ body: envelope(data) });
		assert.deepEqual(
			jsonOf(await boundaryReleases.run({}, client)).data,
			data,
		);
		assert.deepEqual(
			jsonOf(await boundaryReleases.run({ geography: "ward" }, client))
				.data,
			[data[0]],
		);
		assert.equal(requests[0]!.url.pathname, "/v1/boundary-releases");
		assert.equal(requests[0]!.url.search, "");
	});

	it("rejects inconsistent input without calling the API", async () => {
		const { client, requests } = mockApi();
		for (const args of [
			{ release: "2024-07-uk-bgc" },
			{ date: "2020-01" },
			{ geography: "ward", release: "x", date: "2020-01" },
		]) {
			assert.equal(
				(await boundaryReleases.run(args, client)).isError,
				true,
				JSON.stringify(args),
			);
		}
		assert.equal(requests.length, 0);
	});

	it("reports an unknown release", async () => {
		const { client } = mockApi({
			status: 404,
			body: {
				title: "Not found",
				status: 404,
				code: "unknown_release",
				detail: "No such release.",
			},
		});
		const result = await boundaryReleases.run(
			{ geography: "ward", release: "2024-12" },
			client,
		);
		assert.match(textOf(result), /unknown_release/);
	});
});
