import assert from "node:assert/strict";
import test from "node:test";
import type { RouteContext, RouteRequest } from "../src/routing";
import { handleRoute } from "../src/routeHandlers";
import { handleSyncRoutes } from "../src/syncRoutes";
import { route as routeRequest } from "../src/routes";
import { testContext } from "./routeFixtures";

const context = (overrides: Partial<RouteContext> = {}): RouteContext =>
	testContext({
		boundaryRegistry: {
			schemaVersion: 1,
			contentHash: "sha256:registry",
			releases: [],
		},
		...overrides,
	});

const request = (path: string, overrides: Partial<RouteContext> = {}) => {
	const parsedUrl = new URL(path, "http://localhost");
	return {
		context: context(overrides),
		releaseId: "current-release",
		parsedUrl,
		segments: parsedUrl.pathname.split("/").filter(Boolean),
		dispatch: (url: string) => routeRequest("GET", url, context(overrides)),
	} satisfies RouteRequest;
};

test("serves the current Atlas release manifest", () => {
	const atlasRelease = {
		schemaVersion: 1 as const,
		releaseId: "current-release",
		artifacts: [],
	};
	const response = handleRoute(request("/v1/atlas-release", { atlasRelease }));
	assert.equal(response?.status, 200);
	assert.deepEqual((response?.body as { data: unknown }).data, atlasRelease);
});

test("does not claim an archived release route", () => {
	assert.equal(
		handleRoute(request("/v1/unowned-resource")),
		undefined,
	);
});

test("filters the data validation audit", () => {
	const response = handleSyncRoutes(
		request("/v1/validation?scope=data", {
			validationReport: {
				schemaVersion: 1,
				contentHash: "sha256:validation",
				inputs: { boundaryRegistry: "sha256:registry" },
				summary: { resourceCount: 0, checkCount: 0, passedCount: 0, waivedCount: 0, coverage: { boundaryReleases: 0, areaIdentities: 0, servableGeometry: 0, withRelationships: 0, crosswalks: 0, weightedCrosswalks: 0, measures: 0, measureSources: 0 } },
				resources: [],
			},
		}),
	);
	assert.equal(response?.status, 200);
	assert.equal((response?.body as { data: { scope: string } }).data.scope, "data");
});
