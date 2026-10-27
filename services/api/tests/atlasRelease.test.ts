import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { createAtlasRelease } from "../../../pipeline/src/atlasRelease";
import { artifactDirectory } from "../../../shared/dataLayout";

const fixture = (context: TestContext) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-current-build-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = artifactDirectory(root);
	mkdirSync(directory, { recursive: true });
	mkdirSync(join(root, "data/build"), { recursive: true });
	writeFileSync(
		join(root, "data/build/atlas.sqlite"),
		Buffer.from([0, 255, 128, 3]),
	);
	for (const id of [
		"boundary-releases",
		"derived-boundaries",
		"measure-compatibility",
		"export-manifest",
		"lookup-manifest",
		"geometry-sources",
		"analysis-geographies",
		"analysis-geography-validation",
		"relationship-paths",
		"relationship-candidates",
		"geography-inventory",
		"validation-report",
		"source-inventory",
	])
		writeFileSync(join(directory, `${id}.json`), "{}");
	writeFileSync(join(directory, "data-catalog.json"), '{"measures":[]}');
	writeFileSync(
		join(directory, "map-resources.json"),
		'{"resources":[{"id":"ward/test","tiles":{"artifact":"boundaries.pmtiles"},"features":[{"tier":"low","format":"geojson","artifact":"boundaries.geojson.gz"}]}]}',
	);
	writeFileSync(
		join(root, "data/build/boundaries.pmtiles"),
		Buffer.from([255, 0, 128, 4]),
	);
	return { root, directory };
};

test("identifies binary data and remaining runtime files without migrated JSON or resource history", (context) => {
	const { root } = fixture(context);
	const release = createAtlasRelease(root);
	assert.deepEqual(Object.keys(release), [
		"schemaVersion",
		"releaseId",
		"artifacts",
	]);
	assert.deepEqual(
		release.artifacts.find((x) => x.id === "atlas-sqlite"),
		{
			id: "atlas-sqlite",
			path: "data/build/atlas.sqlite",
			contentHash: `sha256:${createHash("sha256")
				.update(Buffer.from([0, 255, 128, 3]))
				.digest("hex")}`,
		},
	);
	assert.ok(
		release.artifacts.some(
			(x) => x.path === "data/build/boundaries.pmtiles",
		),
	);

	assert.equal(
		release.artifacts.some((x) =>
			/postcode-areas|postcode-counts|postcode-index|area-search-index|place-index|boundary-releases|geography-inventory|relationship-paths|analysis-geograph|location-projection|terrain-catalogue|named-locations|area-inventory|crosswalk-inventory/.test(
				x.path,
			),
		),
		false,
	);
	assert.deepEqual(createAtlasRelease(root), release);
});

test("binary changes and runtime catalogue changes change the build id; unused intermediates do not", (context) => {
	const { root, directory } = fixture(context);
	const initial = createAtlasRelease(root).releaseId;
	writeFileSync(join(directory, "named-locations.json"), "unused");
	writeFileSync(
		join(directory, "location-projection-inventory.json"),
		"unused",
	);
	assert.equal(createAtlasRelease(root).releaseId, initial);
	writeFileSync(
		join(root, "data/build/atlas.sqlite"),
		Buffer.from([0, 255, 128, 4]),
	);
	const sqlite = createAtlasRelease(root).releaseId;
	assert.notEqual(sqlite, initial);
	writeFileSync(
		join(root, "data/build/boundaries.pmtiles"),
		Buffer.from([255, 0, 128, 5]),
	);
	const tiles = createAtlasRelease(root).releaseId;
	assert.notEqual(tiles, sqlite);
	writeFileSync(
		join(directory, "validation-report.json"),
		'{"changed":true}',
	);
	assert.notEqual(createAtlasRelease(root).releaseId, tiles);
});

test("download descriptors cover individual observations without requiring their JSON in the manifest", (context) => {
	const { root, directory } = fixture(context);
	const first = createAtlasRelease(root);
	writeFileSync(
		join(directory, "export-manifest.json"),
		JSON.stringify({
			exports: [
				{
					id: "sample",
					artifact: "sample.json.gz",
					contentHash: "sha256:changed",
				},
			],
		}),
	);
	const second = createAtlasRelease(root);
	assert.notEqual(second.releaseId, first.releaseId);
	assert.equal(
		second.artifacts.some((artifact) =>
			artifact.path.endsWith("sample.json.gz"),
		),
		false,
	);
	assert.ok(
		second.artifacts.some((artifact) => artifact.id === "export-manifest"),
	);
});

test("refuses a build with a missing database or declared boundary archive", (context) => {
	const { root, directory } = fixture(context);
	rmSync(join(root, "data/build/boundaries.pmtiles"));
	assert.throws(() => createAtlasRelease(root), /boundary-tiles/);
	rmSync(join(root, "data/build/atlas.sqlite"));
	assert.throws(() => createAtlasRelease(root), /atlas-sqlite/);
});

test("hashes the shared lookup manifest and ignores the former API copy", (context) => {
	const { root, directory } = fixture(context);
	const assets = join(root, "data/build/atlas-assets");
	mkdirSync(assets, { recursive: true });
	const content = '{"schemaVersion":1,"lookups":[]}';
	writeFileSync(join(assets, "atlas-lookups.json"), content);
	writeFileSync(join(directory, "atlas-lookups.json"), "obsolete");
	const release = createAtlasRelease(root);
	assert.deepEqual(
		release.artifacts.find((artifact) => artifact.id === "atlas-lookups"),
		{
			id: "atlas-lookups",
			path: "data/build/atlas-assets/atlas-lookups.json",
			contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
		},
	);
	writeFileSync(
		join(directory, "atlas-lookups.json"),
		"changed obsolete copy",
	);
	assert.equal(createAtlasRelease(root).releaseId, release.releaseId);
});
