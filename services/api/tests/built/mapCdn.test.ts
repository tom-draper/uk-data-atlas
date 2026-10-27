import { createServer } from "node:http";
import { createApiServer } from "../../src/apiServer";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";
import { readApiCatalogues } from "../../src/catalogueLoader";
import { readMapAssets, readMapResources } from "../../src/mapResourceLoader";
import { route } from "../../src/routes";
import { artifactRoot } from "../../../../shared/dataLayout";

const apiRoot = resolve(import.meta.dirname, "../..");
const assetBase = "https://maps.example.com/releases/test";
const tileBase = "https://tiles.example.com/test";

test("CDN mode needs only the map manifest, with no local archives", () => {
	const repository = mkdtempSync(join(tmpdir(), "map-cdn-"));
	const root = join(repository, "services/api");
	try {
		mkdirSync(artifactRoot(root), { recursive: true });
		copyFileSync(
			join(artifactRoot(apiRoot), "map-resources.json"),
			join(artifactRoot(root), "map-resources.json"),
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
		rmSync(repository, { recursive: true, force: true });
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
	// The full tier has no file on the CDN: it keeps the API's own address.
	const full = resource.features.find((entry) => entry.tier === "full")!;
	assert.equal(full.artifact, undefined);
	assert.ok(full.href.startsWith("/v1/map-resources/"));
	const feature = resource.features.find((entry) => entry.artifact)!;
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

test("joins GeoJSON fetched from object storage through the real HTTP server", async (t) => {
	const assets = createServer((request, response) => {
		const path = new URL(request.url ?? "/", "http://localhost").pathname;
		if (!path.startsWith("/maps/map-resources/") || path.includes("..")) {
			response.writeHead(404).end();
			return;
		}
		response.setHeader("content-type", "application/geo+json");
		if (path.endsWith(".gz"))
			response.setHeader("content-encoding", "gzip");
		response.end(
			readFileSync(
				join(apiRoot, "../../data/build", path.slice("/maps/".length)),
			),
		);
	});
	await new Promise<void>((ready) => assets.listen(0, "127.0.0.1", ready));
	t.after(() => {
		assets.closeAllConnections();
		assets.close();
	});
	const address = assets.address();
	assert.ok(address && typeof address !== "string");
	const catalogues = readApiCatalogues(apiRoot, {
		mapAssetBaseUrl: `http://127.0.0.1:${address.port}/maps`,
	});
	catalogues.mapFeatures.clear();
	const api = createApiServer(catalogues);
	await new Promise<void>((ready) => api.listen(0, "127.0.0.1", ready));
	t.after(() => {
		api.closeAllConnections();
		api.close();
	});
	const apiAddress = api.address();
	assert.ok(apiAddress && typeof apiAddress !== "string");
	const response = await fetch(
		`http://127.0.0.1:${apiAddress.port}/v1/boundary-releases/localAuthority/2023-05-uk-bgc-v2:join?format=geojson&tier=low`,
		{
			method: "POST",
			headers: { "content-type": "text/csv" },
			body: "code,value\nE08000025,123\n",
		},
	);
	assert.equal(response.status, 200, await response.clone().text());
	const joined: {
		features: Array<{ properties: { code: string; value: number } }>;
	} = await response.json();
	assert.deepEqual(
		joined.features.map((feature) => [
			feature.properties.code,
			feature.properties.value,
		]),
		[["E08000025", 123]],
	);
});
