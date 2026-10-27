import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaReleaseArtifact,
} from "../shared/areaInventory";
import {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
} from "../shared/boundaryLoader";
import { compileAreaSearchIndex } from "../shared/areaSearch";
import { compilePlaceIndex } from "../shared/placeIndex";
import { createGeographyResolver } from "../shared/geographyResolver";
import { route } from "../services/api/src/routes";
import { testContext } from "../services/api/tests/routeFixtures";
import { apiRootOf } from "../shared/dataLayout";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const before: AreaInventory = JSON.parse(
	readFileSync(join(apiRoot, "public/area-inventory.json"), "utf8"),
);
const after = readAreaInventory(apiRoot);
assert.ok(before.releases.length > 0);
assert.equal(JSON.stringify(after), JSON.stringify(before));
const artifacts = before.releases.flatMap((release) =>
	release.status === "available"
		? [
				JSON.parse(
					readFileSync(
						join(apiRoot, "public", release.artifact),
						"utf8",
					),
				) as AreaReleaseArtifact,
			]
		: [],
);
const json = createAreaLookup(artifacts);
const sqlite = readAreaLookup(apiRoot, after);
let records = 0;
for (const [key, areas] of json) {
	assert.equal(
		JSON.stringify([...sqlite.get(key)!]),
		JSON.stringify([...areas]),
		key,
	);
	records += areas.size;
}
assert.ok(records > 0);
const digest = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");
const registry = readBoundaryRegistry(apiRoot);
for (const compile of [
	compileAreaSearchIndex,
	(lookup: typeof json, hash: string) =>
		compilePlaceIndex(lookup, undefined, hash, registry),
])
	assert.equal(
		digest(compile(sqlite, after.contentHash)),
		digest(compile(json, before.contentHash)),
	);
const contexts = [json, sqlite].map((areaLookup) =>
	testContext({
		boundaryRegistry: registry,
		geographyResolver: createGeographyResolver({
			boundaryRegistry: registry,
			areaInventory: before,
			areaLookup,
		}),
	}),
);
let responses = 0;
for (const release of before.releases) {
	if (release.status !== "available") continue;
	const area = json
		.get(`${release.geography}/${release.id}`)!
		.values()
		.next().value!;
	for (const suffix of [`/${area.code}`, "/missing"]) {
		const url = `/v1/areas/${release.geography}/${release.id}${suffix}`;
		const expected = route("GET", url, contexts[0]);
		assert.ok(expected.status === 200 || suffix === "/missing", url);
		assert.equal(
			JSON.stringify(route("GET", url, contexts[1])),
			JSON.stringify(expected),
			url,
		);
		responses++;
	}
}
console.log(
	`Matched ${before.releases.length} releases, ${records} area records, 2 downstream index outputs and ${responses} API responses byte for byte.`,
);
