import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	createOperationMatcher,
	deprecationHeaders,
	readOperationTemplates,
} from "../src/operationTemplates";

const templates = readOperationTemplates(
	readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"),
);
const match = createOperationMatcher(templates);

test("labels a request by the operation it reached", () => {
	for (const [path, route] of [
		["/v1", "/v1"],
		[
			"/v1/areas/ward/2023-05-uk-bgc/E05000001",
			"/v1/areas/{geography}/{release}/{code}",
		],
		[
			"/v1/areas/ward/2023-05-uk-bgc/E05000001/dossier",
			"/v1/areas/{geography}/{release}/{code}/dossier",
		],
		["/v1/areas:resolve", "/v1/areas:resolve"],
		["/v1/areas:contains", "/v1/areas:contains"],
		["/v1/boundary-releases:resolve", "/v1/boundary-releases:resolve"],
		// A literal segment outranks a placeholder in the same place.
		["/v1/atlas-releases/compare", "/v1/atlas-releases/compare"],
		["/v1/atlas-releases/sha256:abc", "/v1/atlas-releases/{release-id}"],
		[
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2.pmtiles",
			"/v1/map-resources/{geography}/{release}.pmtiles",
		],
		[
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/tiles/3/4/2.mvt",
			"/v1/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt",
		],
		[
			"/v1/atlas-releases/sha256:abc/map-resources/ward/2023-05-uk-bgc",
			"/v1/atlas-releases/{release-id}/map-resources/{geography}/{release}",
		],
		[
			"/v1/atlas-releases/sha256:abc/datasets",
			"/v1/atlas-releases/{release-id}/datasets",
		],
		["/v1/nothing/here", "unmatched"],
		["/v2/areas", "unmatched"],
		["/", "unmatched"],
	] as const) {
		assert.equal(match(path).route, route, path);
	}
	assert.equal(
		match("/v1/atlas-releases/sha256:abc/datasets").pinnedTo,
		"sha256:abc",
	);
});

test("announces a deprecated operation on every response it serves", () => {
	const [deprecated] = readOperationTemplates(
		[
			"openapi: 3.1.0",
			"paths:",
			"  /old:",
			"    get:",
			"      operationId: getOld",
			"      deprecated: true",
			'      x-deprecated-since: "2026-01-01"',
			'      x-sunset: "2027-01-01"',
			"components:",
			"  schemas: {}",
		].join("\n"),
	);
	assert.deepEqual(deprecated, {
		path: "/old",
		deprecation: { since: "2026-01-01", sunset: "2027-01-01" },
	});
	assert.deepEqual(deprecationHeaders(deprecated), {
		deprecation: "@1767225600",
		sunset: "Fri, 01 Jan 2027 00:00:00 GMT",
	});
	assert.deepEqual(deprecationHeaders(templates[0]), {});
});
