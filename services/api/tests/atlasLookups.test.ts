import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { readAtlasLookups } from "@uk-data-atlas/atlas-runtime/storage";
import { route as routeRequest } from "../src/routes";
import { testContext } from "./routeFixtures";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

const lookup = {
	path: "/nowhere",
	bytes: 10,
	gzipBytes: 5,
	contentHash: "sha256:00",
};

test("serves a built atlas lookup as stored", () => {
	const context = testContext({
		atlasLookups: new Map([["area-lineage", lookup]]),
	});
	const response = routeRequest(
		"GET",
		"/v1/atlas-lookups/area-lineage.json",
		context,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(response.representation, {
		contentType: "application/json",
		body: lookup,
	});
});

test("refuses an atlas lookup that is not built", () => {
	const built = testContext({
		atlasLookups: new Map([["area-lineage", lookup]]),
	});
	assert.equal(
		routeRequest("GET", "/v1/atlas-lookups/unknown.json", built).status,
		404,
	);
	assert.equal(
		routeRequest(
			"GET",
			"/v1/atlas-lookups/area-lineage.json",
			testContext(),
		).status,
		503,
	);
});

test("reads the lookup manifest and checks each stored file", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-lookups-"));
	const apiRoot = join(root, "services/api");
	const directory = join(root, "data/build/atlas-assets");
	try {
		mkdirSync(artifactRoot(apiRoot), { recursive: true });
		writeFileSync(
			join(artifactRoot(apiRoot), "atlas-lookups.json"),
			"obsolete invalid manifest",
		);
		assert.equal(readAtlasLookups(apiRoot).size, 0);
		const json = '{"a":1}';
		const gzipped = gzipSync(json);
		mkdirSync(join(directory, "atlas-lookups"), {
			recursive: true,
		});
		writeFileSync(
			join(directory, "atlas-lookups", "area-lineage.json.gz"),
			gzipped,
		);
		const entry = {
			id: "area-lineage",
			artifact: "atlas-lookups/area-lineage.json.gz",
			bytes: json.length,
			gzipBytes: gzipped.length,
			contentHash: "sha256:00",
		};
		const writeManifest = (lookups: unknown[]) =>
			writeFileSync(
				join(directory, "atlas-lookups.json"),
				JSON.stringify({ schemaVersion: 1, lookups }),
			);
		writeManifest([entry]);
		assert.deepEqual(readAtlasLookups(apiRoot).get("area-lineage"), {
			path: join(directory, "atlas-lookups", "area-lineage.json.gz"),
			bytes: json.length,
			gzipBytes: gzipped.length,
			contentHash: "sha256:00",
		});
		writeManifest([{ ...entry, gzipBytes: gzipped.length + 1 }]);
		assert.throws(() => readAtlasLookups(apiRoot), /size mismatch/);
		writeManifest([{ ...entry, artifact: "../secrets.json.gz" }]);
		assert.throws(() => readAtlasLookups(apiRoot), /Invalid atlas lookup/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
