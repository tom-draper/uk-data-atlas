import assert from "node:assert/strict";
import test from "node:test";
import type { RouteContext, RouteRequest } from "../src/routing";
import { handleRoute } from "../src/routeHandlers";
import { handleSyncRoutes } from "../src/syncRoutes";
import { route as routeRequest } from "../src/routes";
import type { AtlasRelease } from "../src/atlasRelease";
import type { ValidationReport } from "../src/validationReport";
import {
	route,
	registry,
	testContext,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	atlasRelease,
	relationshipCandidateInventory,
	validationReport,
} from "./routeFixtures";

const context = (overrides: Partial<RouteContext> = {}): RouteContext => ({
	boundaryRegistry: {
		schemaVersion: 1,
		contentHash: "sha256:registry",
		releases: [],
	},
	...overrides,
});

const request = (
	path: string,
	overrides: Partial<RouteContext> = {},
): RouteRequest => {
	const parsedUrl = new URL(path, "http://localhost");
	return {
		context: context(overrides),
		releaseId: "current-release",
		parsedUrl,
		segments: parsedUrl.pathname.split("/").filter(Boolean),
		dispatch: (url) => routeRequest("GET", url, context(overrides)),
	};
};

test("leaves resources outside the sync domain for another handler", () => {
	assert.equal(handleSyncRoutes(request("/v1/geographies")), undefined);
});

test("dispatches only the route family that owns a resource", () => {
	const atlasRelease = {
		schemaVersion: 1 as const,
		releaseId: "current-release",
		artifacts: [],
	};
	assert.equal(
		handleRoute(request("/v1/atlas-release", { atlasRelease }))?.status,
		200,
	);
	assert.equal(handleRoute(request("/v1/not-a-resource")), undefined);
});

test("serves the current immutable Atlas release", () => {
	const atlasRelease = {
		schemaVersion: 1 as const,
		releaseId: "current-release",
		artifacts: [],
	};
	const response = handleSyncRoutes(
		request("/v1/atlas-release", { atlasRelease }),
	);
	assert.equal(response?.status, 200);
	assert.deepEqual((response?.body as { data: unknown }).data, atlasRelease);
});

test("downloads a retained artifact from an archived release", () => {
	const archived = {
		schemaVersion: 1 as const,
		releaseId: "archived-release",
		artifacts: [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: "sha256:fixture",
			},
		],
	};
	const response = handleRoute(
		request(
			"/v1/atlas-releases/archived-release/artifacts?artifact=data-catalog",
			{
				atlasReleaseHistory: new Map([[archived.releaseId, archived]]),
				readReleaseArtifact: (releaseId, artifactId) =>
					releaseId === archived.releaseId &&
					artifactId === "data-catalog"
						? {
								artifact: archived.artifacts[0]!,
								body: Buffer.from("{}\n"),
							}
						: undefined,
			},
		),
	);
	assert.equal(response?.status, 200);
	assert.equal(response?.cache, "immutable");
	assert.equal(response?.representation?.contentType, "application/json");
	assert.equal(response?.representation?.body.toString(), "{}\n");
});

test("refuses an archived artifact whose retained bytes are absent", () => {
	const archived = {
		schemaVersion: 1 as const,
		releaseId: "archived-release",
		artifacts: [],
	};
	const response = handleSyncRoutes(
		request(
			"/v1/atlas-releases/archived-release/artifacts?artifact=data-catalog",
			{
				atlasReleaseHistory: new Map([[archived.releaseId, archived]]),
				readReleaseArtifact: () => undefined,
			},
		),
	);
	assert.equal(response?.status, 410);
});

test("filters validation resources without changing their response envelope", () => {
	const response = handleSyncRoutes(
		request("/v1/validation?status=passed", {
			validationReport: {
				schemaVersion: 1,
				contentHash: "sha256:validation",
				inputs: { boundaryRegistry: "sha256:registry" },
				summary: {
					resourceCount: 2,
					checkCount: 2,
					passedCount: 1,
					waivedCount: 1,
					coverage: {
						boundaryReleases: 0,
						areaIdentities: 0,
						servableGeometry: 0,
						withRelationships: 0,
						crosswalks: 0,
						weightedCrosswalks: 0,
						measures: 2,
						measureSources: 0,
					},
				},
				resources: [
					{
						id: "measures/example",
						kind: "measure",
						status: "passed",
						checks: [
							{ id: "measure-definition", status: "passed" },
						],
					},
					{
						id: "measures/waived",
						kind: "measure",
						status: "waived",
						checks: [
							{
								id: "measure-definition",
								status: "waived",
								waiver: { reason: "example" },
							},
						],
					},
				],
			},
		}),
	);
	assert.equal(response?.status, 200);
	assert.deepEqual((response?.body as { data: unknown }).data, {
		schemaVersion: 1,
		contentHash: "sha256:validation",
		inputs: { boundaryRegistry: "sha256:registry" },
		summary: {
			resourceCount: 2,
			checkCount: 2,
			passedCount: 1,
			waivedCount: 1,
			coverage: {
				boundaryReleases: 0,
				areaIdentities: 0,
				servableGeometry: 0,
				withRelationships: 0,
				crosswalks: 0,
				weightedCrosswalks: 0,
				measures: 2,
				measureSources: 0,
			},
		},
		resources: [
			{
				id: "measures/example",
				kind: "measure",
				status: "passed",
				checks: [{ id: "measure-definition", status: "passed" }],
			},
		],
	});
});

const validationRoute = (url: string, report?: ValidationReport) =>
	routeRequest(
		"GET",
		url,
		testContext({
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			atlasRelease,
			relationshipCandidateInventory,
			validationReport: report,
		}),
	);

test("gets the atlas release manifest", () => {
	const response = route(
		"GET",
		"/v1/atlas-release",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"atlasRelease" in response.body && response.body.atlasRelease,
		atlasRelease.releaseId,
	);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		atlasRelease,
	);
});

test("lists and compares archived Atlas releases by immutable artifact hash", () => {
	const previous: AtlasRelease = {
		schemaVersion: 1,
		releaseId: "sha256:previous-release",
		artifacts: [
			{
				id: "boundary-registry",
				path: "boundary-releases.json",
				contentHash: "sha256:previous-registry",
			},
		],
	};
	const context = {
		boundaryRegistry: registry,
		atlasRelease,
		atlasReleaseHistory: new Map([
			[previous.releaseId, previous],
			[atlasRelease.releaseId, atlasRelease],
		]),
	};
	const releases = routeRequest("GET", "/v1/atlas-releases", context);
	assert.equal(releases.status, 200);
	assert.equal(
		(("data" in releases.body ? releases.body.data : []) as unknown[])
			.length,
		2,
	);
	const comparison = routeRequest(
		"GET",
		`/v1/atlas-releases/compare?from=${previous.releaseId}`,
		context,
	);
	assert.equal(comparison.status, 200);
	assert.deepEqual(
		"data" in comparison.body &&
			(comparison.body.data as { summary: unknown }).summary,
		{ added: 0, removed: 0, changed: 1, unchanged: 0 },
	);
});

test("compares changed release resources by their published field paths on request", () => {
	const previous: AtlasRelease = {
		schemaVersion: 1,
		releaseId: "sha256:previous-fields",
		artifacts: [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: "sha256:before-catalog",
			},
		],
		resources: { datasets: { jobs: "sha256:one" } },
	};
	const current: AtlasRelease = {
		...previous,
		releaseId: "sha256:current-fields",
		artifacts: [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: "sha256:after-catalog",
			},
		],
		resources: { datasets: { jobs: "sha256:two" } },
	};
	const body = (recordCount: number) =>
		Buffer.from(
			JSON.stringify({
				datasets: [
					{ id: "jobs", summary: { dataRecordCount: recordCount } },
				],
			}),
		);
	const response = handleSyncRoutes(
		request(
			`/v1/atlas-releases/compare?from=${previous.releaseId}&to=${current.releaseId}&detail=fields`,
			{
				atlasRelease: current,
				atlasReleaseHistory: new Map([
					[previous.releaseId, previous],
					[current.releaseId, current],
				]),
				readReleaseArtifact: (releaseId, artifactId) =>
					artifactId === "data-catalog"
						? {
								artifact:
									(releaseId === previous.releaseId
										? previous
										: current).artifacts[0]!,
								body: body(releaseId === previous.releaseId ? 10 : 12),
							}
						: undefined,
			},
		),
	);
	assert.equal(response?.status, 200);
	assert.deepEqual(
		(response?.body as { data: { semantic: unknown } }).data.semantic,
		{
			status: "available",
			changes: [
				{
					kind: "datasets",
					id: "jobs",
					fields: ["summary.dataRecordCount"],
				},
			],
		},
	);
});

test("reports the atlas release as unavailable before it is built", () => {
	const response = route("GET", "/v1/atlas-release", registry);
	assert.equal(response.status, 503);
});

test("serves the validation report, optionally only resources with waivers", () => {
	const all = validationRoute("/v1/validation", validationReport);
	assert.equal(all.status, 200);
	assert.deepEqual("data" in all.body && all.body.data, validationReport);
	const waived = validationRoute(
		"/v1/validation?status=waived",
		validationReport,
	);
	assert.deepEqual(
		"data" in waived.body &&
			(waived.body.data as ValidationReport).resources.map(
				(resource) => resource.id,
			),
		["boundary-releases/ward/2025-01-en-ward"],
	);
	assert.equal(
		validationRoute("/v1/validation?status=failed", validationReport)
			.status,
		400,
	);
});

test("extracts a release-pinned quality audit for served data", () => {
	const response = validationRoute(
		"/v1/validation?scope=data",
		validationReport,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		schemaVersion: 1,
		contentHash: "sha256:validation",
		inputs: { boundaryRegistry: "sha256:registry" },
		scope: "data",
		summary: {
			resourceCount: 1,
			checkCount: 1,
			passedCount: 1,
			waivedCount: 0,
		},
		resources: [validationReport.resources[3]],
		note: "This is the source-observation quality audit. It checks artifact integrity, duplicate area-period records, area-code resolution, declared country coverage, value semantics and published intervals. An unwaived failure prevents publication; any waiver remains visible here.",
	});
	assert.equal(
		validationRoute("/v1/validation?scope=boundaries", validationReport)
			.status,
		400,
	);
});

test("serves one resource's validation at the resource's own path", () => {
	const release = validationRoute(
		"/v1/validation/boundary-releases/ward/2025-01-en-ward",
		validationReport,
	);
	assert.equal(release.status, 200);
	assert.deepEqual(
		"data" in release.body && release.body.data,
		validationReport.resources[0],
	);
	const crosswalk = validationRoute(
		"/v1/validation/crosswalks/constituency-2010-to-2024-official-lookup-v2",
		validationReport,
	);
	assert.equal(crosswalk.status, 200);
	assert.deepEqual(
		"data" in crosswalk.body && crosswalk.body.data,
		validationReport.resources[1],
	);
	for (const [path, resource] of [
		["/v1/validation/measures/crime-total", validationReport.resources[2]],
		[
			"/v1/validation/exports/crime-total-observations",
			validationReport.resources[3],
		],
	] as const) {
		const response = validationRoute(path, validationReport);
		assert.equal(response.status, 200);
		assert.deepEqual(
			"data" in response.body && response.body.data,
			resource,
		);
	}
	for (const path of [
		"/v1/validation/crosswalks/unknown",
		"/v1/validation/measures/unknown",
		"/v1/validation/exports/crime-total-observations/records",
	]) {
		assert.equal(validationRoute(path, validationReport).status, 404);
	}
	assert.equal(
		validationRoute("/v1/validation/areas/ward", validationReport).status,
		404,
	);
});

test("reports validation as unavailable before the report is built", () => {
	assert.equal(validationRoute("/v1/validation").status, 503);
	assert.equal(
		validationRoute("/v1/validation/crosswalks/unknown").status,
		503,
	);
});
