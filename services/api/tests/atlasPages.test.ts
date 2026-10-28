import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { readAtlasPages } from "../src/atlasPages";
import { route as routeRequest } from "../src/routes";
import { testContext } from "./routeFixtures";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

const page = {
	path: "/nowhere",
	bytes: 10,
	gzipBytes: 5,
	contentHash: "sha256:00",
};

test("serves a built atlas page as stored", () => {
	const context = testContext({
		atlasPages: new Map([["places-area-E050001", page]]),
	});
	const response = routeRequest(
		"GET",
		"/v1/atlas-pages/places-area-E050001.json",
		context,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(response.representation, {
		contentType: "application/json",
		body: page,
	});
});

test("refuses an atlas page that is not built", () => {
	const built = testContext({
		atlasPages: new Map([["places-area-E050001", page]]),
	});
	assert.equal(
		routeRequest("GET", "/v1/atlas-pages/unknown.json", built).status,
		404,
	);
	assert.equal(
		routeRequest(
			"GET",
			"/v1/atlas-pages/places-area-E050001.json",
			testContext(),
		).status,
		503,
	);
});

test("reads the page manifest and checks each stored file", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-pages-"));
	const apiRoot = join(root, "services/api");
	const directory = join(root, "data/build/atlas-assets");
	try {
		mkdirSync(artifactRoot(apiRoot), { recursive: true });
		writeFileSync(
			join(artifactRoot(apiRoot), "atlas-pages.json"),
			"obsolete invalid manifest",
		);
		assert.equal(readAtlasPages(apiRoot).size, 0);
		const json = '{"a":1}';
		const gzipped = gzipSync(json);
		mkdirSync(join(directory, "atlas-pages"), {
			recursive: true,
		});
		writeFileSync(
			join(directory, "atlas-pages", "places-area-E050001.json.gz"),
			gzipped,
		);
		const entry = {
			id: "places-area-E050001",
			artifact: "atlas-pages/places-area-E050001.json.gz",
			bytes: json.length,
			gzipBytes: gzipped.length,
			contentHash: "sha256:00",
		};
		const writeManifest = (pages: unknown[]) =>
			writeFileSync(
				join(directory, "atlas-pages.json"),
				JSON.stringify({ schemaVersion: 1, pages }),
			);
		writeManifest([entry]);
		assert.deepEqual(readAtlasPages(apiRoot).get("places-area-E050001"), {
			path: join(directory, "atlas-pages", "places-area-E050001.json.gz"),
			bytes: json.length,
			gzipBytes: gzipped.length,
			contentHash: "sha256:00",
		});
		writeManifest([{ ...entry, gzipBytes: gzipped.length + 1 }]);
		assert.throws(() => readAtlasPages(apiRoot), /size mismatch/);
		writeManifest([{ ...entry, artifact: "../secrets.json.gz" }]);
		assert.throws(() => readAtlasPages(apiRoot), /Invalid atlas page/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
