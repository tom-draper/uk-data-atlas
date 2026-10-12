import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";
import { readApiCatalogues } from "../../src/catalogueLoader";
import { readMapAssets, readMapResources } from "../../src/mapResourceLoader";
import { route } from "../../src/routes";

const apiRoot = resolve(import.meta.dirname, "../..");
const assetBase = "https://maps.example.com/releases/test";
const tileBase = "https://tiles.example.com/test";

test("CDN mode needs only the map manifest, with no local archives", () => {
	const root = mkdtempSync(join(tmpdir(), "map-cdn-"));
	try {
		mkdirSync(join(root, "public"));
		copyFileSync(
			join(apiRoot, "public/map-resources.json"),
			join(root, "public/map-resources.json"),
		);
		const resources = readMapResources(root, assetBase, tileBase);
		assert.ok(resources.resources.length > 0);
		assert.equal(readMapAssets(root, resources).mapArchives.size, 0);
		for (const resource of resources.resources)
			assert.equal(
				resource.tiles.href,
				`${assetBase}/${resource.tiles.artifact}`,
			);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("redirects archive, feature and tile requests and advertises the tile CDN", () => {
	const catalogues = readApiCatalogues(apiRoot, {
		mapAssetBaseUrl: assetBase,
		mapTileBaseUrl: tileBase,
	});
	const resource = catalogues.mapResources.resources[0]!;
	const archive = route(
		"GET",
		`/v1/map-resources/${resource.id}.pmtiles`,
		catalogues,
	);
	assert.equal(archive.status, 307);
	assert.equal(
		archive.headers?.location,
		`${assetBase}/${resource.tiles.artifact}`,
	);
	const feature = resource.features[0]!;
	const response = route(
		"GET",
		`/v1/map-resources/${resource.id}/features?tier=${feature.tier}&format=${feature.format === "geojson" ? "geojson" : "geoparquet"}`,
		catalogues,
	);
	assert.equal(response.status, 307);
	assert.equal(
		response.headers?.location,
		`${assetBase}/${feature.artifact}`,
	);
	const tile = route(
		"GET",
		`/v1/map-resources/${resource.id}/tiles/0/0/0.mvt`,
		catalogues,
	);
	assert.equal(tile.status, 307);
	assert.equal(
		tile.headers?.location,
		`${tileBase}/${resource.id}/tiles/0/0/0.mvt`,
	);
	const tileJson = route(
		"GET",
		`/v1/map-resources/${resource.id}/tiles.json`,
		catalogues,
	);
	assert.equal(tileJson.status, 200);
	assert.match(
		JSON.stringify(tileJson.body),
		/https:\/\/tiles.example.com\/test/,
	);
});
