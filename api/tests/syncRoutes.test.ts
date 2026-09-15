import assert from "node:assert/strict";
import test from "node:test";
import type { RouteContext, RouteRequest } from "../src/routing";
import { handleRoute } from "../src/routeHandlers";
import { handleSyncRoutes } from "../src/syncRoutes";

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
