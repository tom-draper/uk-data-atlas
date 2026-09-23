import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import {
	compatibleWardAreaLookup,
	registry,
	testContext,
} from "./routeFixtures";

const dossierRegistry = {
	...registry,
	releases: registry.releases.map((release) => ({
		...release,
		id: "2023-05-uk-bgc",
		title: "Wards, May 2023",
	})),
};

test("starts an exact geography query with an evidence-led area dossier", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/dossier",
		testContext({
			boundaryRegistry: dossierRegistry,
			areaLookup: compatibleWardAreaLookup,
		}),
	);
	assert.equal(response.status, 200);
	assert.equal(
		((response.body as { data: { trust: { level: string } } }).data.trust.level),
		"limited",
	);
	const data = ("data" in response.body && response.body.data) as {
		id: string;
		name: string;
		boundary: { title: string; source: { publisher: string } };
		availability: {
			geometry: { status: string; href: string };
			relationships: { status: string; count: number; href: string };
			data: { href: string };
			history: { href: string };
		};
		links: Record<string, string>;
	};
	assert.equal(data.id, "ward/2023-05-uk-bgc/E05000001");
	assert.equal(data.name, "Compatible ward");
	assert.deepEqual(data.boundary, {
		title: "Wards, May 2023",
		temporalCoverage: "2023",
		coverage: { countries: ["GB-ENG"] },
		source: {
			publisher: "ONS",
			url: "https://example.com/source",
			licence: { name: "Open Government Licence" },
		},
		metadataHash: "sha256:metadata",
	});
	assert.deepEqual(data.availability.geometry, {
		status: "not-built",
		reason: "Build the geometry source registry before serving geometry.",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/geometry",
	});
	assert.deepEqual(data.availability.relationships, {
		status: "not-built",
		reason: "Build the crosswalk inventory before serving area relationships.",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/relationships",
	});
	assert.equal(
		data.availability.data.href,
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/capabilities",
	);
	assert.equal(
		data.availability.history.href,
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/history",
	);
	assert.equal(
		data.links.boundaryRelease,
		"/v1/boundary-releases/ward/2023-05-uk-bgc",
	);
});

test("keeps the usual helpful absence report for a missing dossier area", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000999/dossier",
		testContext({
			boundaryRegistry: dossierRegistry,
			areaLookup: compatibleWardAreaLookup,
		}),
	);
	assert.equal(response.status, 404);
	assert.equal(
		(response.body as { code?: string }).code,
		"area_not_in_release",
	);
});
