import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import { compileAtlasLookups } from "@uk-data-atlas/geography";
import { readAreaInventory, readAreaLookup } from "../shared/boundaryLoader";
import { createRelationshipPathIndex } from "../shared/relationshipPaths";
import type { CrosswalkLookup } from "../shared/translation";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../shared/crosswalkInventory";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "../shared/crosswalkLoader";
import { readStoredText } from "../shared/storedText";
import {
	compileRelationshipPaths,
	crosswalkShape,
	type CrosswalkShape,
} from "../shared/relationshipPaths";
import { readApprovedRelationshipPaths } from "../pipeline/src/relationshipPathAdapters";
import { createGeographyResolver } from "../shared/geographyResolver";
import { route } from "../services/api/src/routes";
import { testContext } from "../services/api/tests/routeFixtures";
import { apiRootOf } from "../shared/dataLayout";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const before: CrosswalkInventory = JSON.parse(
	readFileSync(join(apiRoot, "public/crosswalk-inventory.json"), "utf8"),
);
const after = readCrosswalkInventory(apiRoot);
assert.ok(before.crosswalks.length > 0);
assert.equal(JSON.stringify(after), JSON.stringify(before));
const sqlite = readCrosswalkLookup(apiRoot, after);
const shapes = [
	new Map<string, CrosswalkShape>(),
	new Map<string, CrosswalkShape>(),
];
let records = 0;
let targets = 0;
let responses = 0;
for (const entry of before.crosswalks) {
	const json: CrosswalkArtifact = JSON.parse(
		readStoredText(join(apiRoot, "public", entry.artifact)),
	);
	const loaded = sqlite.get(entry.id)!;
	assert.equal(JSON.stringify(loaded), JSON.stringify(json), entry.id);
	records += json.records.length;
	targets += json.records.reduce(
		(total, record) => total + record.targets.length,
		0,
	);
	shapes[0].set(entry.id, crosswalkShape(json));
	shapes[1].set(entry.id, crosswalkShape(loaded));
	const contexts = [json, loaded].map((artifact) =>
		testContext({
			geographyResolver: createGeographyResolver({
				crosswalkInventory: before,
				crosswalkLookup: new Map([[entry.id, artifact]]),
			}),
		}),
	);
	const urls = [
		`/v1/crosswalks/${entry.id}`,
		`/v1/crosswalks/${entry.id}/records`,
		`/v1/crosswalks/${entry.id}/records?source=${json.records[0]?.source.code ?? "missing"}`,
		`/v1/crosswalks/${entry.id}/records?source=missing`,
	];
	for (const url of urls) {
		const expected = route("GET", url, contexts[0]);
		assert.equal(expected.status, 200, url);
		assert.equal(
			JSON.stringify(route("GET", url, contexts[1])),
			JSON.stringify(expected),
			url,
		);
		responses++;
	}
}
console.log(
	`Compared ${before.crosswalks.length} artifacts and ${responses} responses.`,
);
assert.ok(records > 0 && targets > 0);
const approved = readApprovedRelationshipPaths(
	join(apiRoot, "config/relationship-paths.json"),
);
const digest = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(
	digest(
		compileRelationshipPaths(after, approved, {
			shapes: shapes[1],
			maximumSteps: 24,
		}),
	),
	digest(
		compileRelationshipPaths(before, approved, {
			shapes: shapes[0],
			maximumSteps: 24,
		}),
	),
);
const paths = compileRelationshipPaths(after, approved, {
	shapes: shapes[1],
	maximumSteps: 24,
});
shapes[0].clear();
shapes[1].clear();
const jsonCache = new Map<
	string,
	{ artifact: CrosswalkArtifact; bytes: number }
>();
let cacheBytes = 0;
const readJson = (id: string) => {
	const cached = jsonCache.get(id);
	if (cached) {
		jsonCache.delete(id);
		jsonCache.set(id, cached);
		return cached.artifact;
	}
	const entry = before.crosswalks.find((entry) => entry.id === id);
	if (!entry) return undefined;
	const text = readStoredText(join(apiRoot, "public", entry.artifact));
	const artifact: CrosswalkArtifact = JSON.parse(text);
	const bytes = Buffer.byteLength(text);
	if (bytes <= 64 * 1024 * 1024) {
		while (cacheBytes + bytes > 64 * 1024 * 1024) {
			const oldest = jsonCache.keys().next().value!;
			cacheBytes -= jsonCache.get(oldest)!.bytes;
			jsonCache.delete(oldest);
		}
		jsonCache.set(id, { artifact, bytes });
		cacheBytes += bytes;
	}
	return artifact;
};
const jsonLookup: CrosswalkLookup = {
	get: readJson,
	*values() {
		for (const entry of before.crosswalks) yield readJson(entry.id)!;
	},
	where(predicate) {
		return before.crosswalks
			.filter(predicate)
			.map((entry) => readJson(entry.id)!);
	},
};
const areaInventory = readAreaInventory(apiRoot);
function lookupSnapshot(crosswalkLookup: CrosswalkLookup) {
	const resolver = createGeographyResolver({
		areaInventory,
		areaLookup: readAreaLookup(apiRoot, areaInventory),
		crosswalkInventory: before,
		crosswalkLookup,
		relationshipPathIndex: createRelationshipPathIndex(paths),
	});
	return [...compileAtlasLookups(resolver, ATLAS_BOUNDARY_VINTAGES)].map(
		([name, text]) => [name, digest(text)],
	);
}
console.log("Comparing atlas lookup outputs.");
const beforeLookups = lookupSnapshot(jsonLookup);
assert.ok(beforeLookups.length > 0);
assert.deepEqual(lookupSnapshot(sqlite), beforeLookups);
console.log(
	`Matched ${before.crosswalks.length} crosswalks, ${records} source rows, ${targets} target rows, relationship-path output, ${beforeLookups.length} atlas lookup outputs and ${responses} API responses byte for byte.`,
);
