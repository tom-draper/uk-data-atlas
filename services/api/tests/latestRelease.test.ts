import assert from "node:assert/strict";
import test from "node:test";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { route } from "../src/routes";
import { areaLookup, registry, testContext } from "./routeFixtures";

// An older release beside the fixture's, so `latest` has a choice to make.
const withOlder: BoundaryRegistry = {
	...registry,
	releases: [
		{ ...registry.releases[0]!, id: "2024-05-en-ward" },
		...registry.releases,
	],
};
const context = testContext({ boundaryRegistry: withOlder, areaLookup });
const get = (path: string) => route("GET", path, context);

test("reads latest as the geography's newest release and names the one read", () => {
	const area = get("/v1/areas/ward/latest/E05000001");
	assert.equal(area.status, 200);
	assert.equal(
		(area.body as { data: { boundaryRelease: string } }).data
			.boundaryRelease,
		"2025-01-en-ward",
	);
	assert.equal(
		area.headers?.["content-location"],
		"/v1/areas/ward/2025-01-en-ward/E05000001",
	);

	const history = get("/v1/areas/ward/latest/E05000001/history?limit=5");
	assert.equal(
		history.headers?.["content-location"],
		"/v1/areas/ward/2025-01-en-ward/E05000001/history?limit=5",
	);

	const release = get("/v1/boundary-releases/ward/latest");
	assert.equal(release.status, 200);
	assert.equal(
		release.headers?.["content-location"],
		"/v1/boundary-releases/ward/2025-01-en-ward",
	);
});

test("keeps what follows latest in its segment", () => {
	const join = route(
		"POST",
		"/v1/boundary-releases/ward/latest:join",
		context,
		{ contentType: "text/csv", text: "code,value\nE05000001,1\n" },
	);
	assert.equal(
		join.headers?.["content-location"],
		"/v1/boundary-releases/ward/2025-01-en-ward:join",
	);
});

test("refuses latest for a geography it does not hold", () => {
	const response = get("/v1/areas/parish/latest/E04000001");
	assert.equal(response.status, 404);
	assert.equal(
		(response.body as { code: string }).code,
		"unsupported_geography",
	);
});

test("takes a geography's only release as its latest, dated or not", () => {
	const only: BoundaryRegistry = {
		...registry,
		releases: [{ ...registry.releases[0]!, id: "2011-ni" }],
	};
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/latest",
		testContext({ boundaryRegistry: only, areaLookup }),
	);
	assert.equal(response.status, 200);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/boundary-releases/ward/2011-ni",
	);
});

test("uses registry dates to select latest for year-only release ids", () => {
	const dated: BoundaryRegistry = {
		...registry,
		releases: [
			{
				...registry.releases[0]!,
				id: "2021-ni",
				temporalCoverage: "2021",
			},
			{
				...registry.releases[0]!,
				id: "2022-sc-bfc",
				temporalCoverage: "2022",
			},
		],
	};
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/latest",
		testContext({ boundaryRegistry: dated, areaLookup }),
	);
	assert.equal(response.status, 200);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/boundary-releases/ward/2022-sc-bfc",
	);
});

test("will not guess the newest release when neither id nor metadata dates it", () => {
	const mixed: BoundaryRegistry = {
		...withOlder,
		releases: [
			...withOlder.releases,
			{
				...registry.releases[0]!,
				id: "undated-sc-bfc",
				temporalCoverage: undefined,
			},
		],
	};
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/latest",
		testContext({ boundaryRegistry: mixed, areaLookup }),
	);
	assert.equal(response.status, 409);
	const body = response.body as {
		detail: string;
		choices: Array<{ id: string }>;
	};
	assert.match(body.detail, /undated-sc-bfc has no date/);
	assert.deepEqual(
		body.choices.map((choice) => choice.id),
		["2025-01-en-ward", "undated-sc-bfc"],
	);
});
