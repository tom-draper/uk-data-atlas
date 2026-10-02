import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
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

test("expands an exact area with an evidence-led dossier", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000001?include=dossier",
		testContext({
			boundaryRegistry: dossierRegistry,
			areaLookup: compatibleWardAreaLookup,
		}),
	);
	assert.equal(response.status, 200);
	const area = ("data" in response.body && response.body.data) as {
		id: string;
		name: string;
		dossier: unknown;
	};
	assert.equal(area.id, "ward/2023-05-uk-bgc/E05000001");
	assert.equal(area.name, "Compatible ward");
	const data = area.dossier as {
		trust: { level: string };
		id: string;
		name: string;
		boundary: { title: string; source: { publisher: string } };
		availability: {
			geometry: { status: string; href: string };
			relationships: { status: string; count: number; href: string };
			data: { href: string };
			history: { href: string };
		};
		extent: { status: string; reason: string; href: string };
		links: Record<string, string>;
	};
	assert.equal(data.trust.level, "limited");
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
	assert.deepEqual(data.extent, {
		status: "not-built",
		reason: "Build the geometry source registry before serving geometry.",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/geometry/metadata",
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

test("expands an exact area with its dossier without repeating its identity", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000001?include=dossier",
		testContext({
			boundaryRegistry: dossierRegistry,
			areaLookup: compatibleWardAreaLookup,
		}),
	);
	assert.equal(response.status, 200);
	const data = (
		response.body as {
			data: {
				id: string;
				dossier?: { validity: { releases: unknown[] } };
			};
		}
	).data;
	assert.equal(data.id, "ward/2023-05-uk-bgc/E05000001");
	assert.deepEqual(data.dossier?.validity.releases, [
		{
			boundaryRelease: "2023-05-uk-bgc",
			name: "Compatible ward",
			href: "/v1/areas/ward/2023-05-uk-bgc/E05000001?include=dossier",
		},
	]);
});

test("refuses unsupported exact-area expansions", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000001?include=geometry",
		testContext({
			boundaryRegistry: dossierRegistry,
			areaLookup: compatibleWardAreaLookup,
		}),
	);
	assert.equal(response.status, 400);
	assert.equal(
		(response.body as { title?: string }).title,
		"Invalid Include",
	);
});

test("keeps the usual helpful absence report for a missing dossier area", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000999?include=dossier",
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

test("states the releases holding a code and its release-pinned extent", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2023-05-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD23CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const spanLookup = createAreaLookup(
			["2022-05-en-ward", "2023-05-en-ward"].map((boundaryRelease) => ({
				schemaVersion: 1 as const,
				contentHash: `sha256:${boundaryRelease}`,
				geography: "ward",
				boundaryRelease,
				codeProperty: "WD23CD",
				nameProperty: "WD23NM",
				areas: [{ code: "E05000001", name: "Example ward" }],
			})),
		);
		const spanRegistry = {
			...registry,
			releases: ["2022-05-en-ward", "2023-05-en-ward"].map((id) => ({
				...registry.releases[0]!,
				id,
				title: `Wards, ${id.slice(0, 4)}`,
				temporalCoverage: id.slice(0, 4),
			})),
		};
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2023-05-en-ward",
				{
					input: "boundaries/ward/2023-05-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD23CD",
				},
			],
		]);
		const response = routeRequest(
			"GET",
			"/v1/areas/ward/2023-05-en-ward/E05000001?include=dossier",
			testContext({
				boundaryRegistry: spanRegistry,
				areaLookup: spanLookup,
				areaGeometryCache: new AreaGeometryCache(root, sources),
			}),
		);
		assert.equal(response.status, 200);
		const data = (response.body as { data: Record<string, any> }).data
			.dossier;
		assert.deepEqual(data.validity.releases, [
			{
				boundaryRelease: "2022-05-en-ward",
				name: "Example ward",
				href: "/v1/areas/ward/2022-05-en-ward/E05000001?include=dossier",
			},
			{
				boundaryRelease: "2023-05-en-ward",
				name: "Example ward",
				href: "/v1/areas/ward/2023-05-en-ward/E05000001?include=dossier",
			},
		]);
		assert.match(data.validity.note, /not a legal validity date/);
		assert.deepEqual(data.extent, {
			status: "available",
			boundingBox: [-2, 54, -1, 55],
			crs: "OGC:CRS84",
			href: "/v1/areas/ward/2023-05-en-ward/E05000001/geometry/metadata",
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
