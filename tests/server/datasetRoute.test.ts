import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/data/catalogue/[sha256]/[output]/route";
import { buildAtlasSqlite } from "@/pipeline/src/atlas/buildAtlasSqlite";
import { readAtlasDatasetUrls } from "@uk-data-atlas/catalogue/node";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { atlasCachePath } from "@uk-data-atlas/atlas-db";

let root: string;
const stored = gzipSync('{"2024":{"value":42}}\n', { level: 9 });
const payload = '{"2024":{"value":42}}\n';
const sha256 = createHash("sha256").update(payload).digest("hex");
const request = (
	hash = sha256,
	output = "sample.json",
	headers: HeadersInit = {},
) =>
	GET(new Request("http://localhost/data/catalogue", { headers }), {
		params: Promise.resolve({ sha256: hash, output }),
	});

/** Serve the sample from the cache, as a dataset generated from rows is. */
function cacheSample() {
	const database = new DatabaseSync(
		join(root, "data/build/atlas-base.sqlite"),
	);
	database.exec(
		"UPDATE dataset_catalogue SET sha256 = 'source', payload_id = NULL WHERE output = 'sample'",
	);
	database.close();
	const cache = new DatabaseSync(atlasCachePath(root));
	cache
		.prepare("INSERT INTO dataset_payload VALUES (?, ?, ?, ?, ?)")
		.run("sample", "source", sha256, Buffer.byteLength(payload), stored);
	cache.close();
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "dataset-route-"));
	mkdirSync(join(root, "data/build/datasets"), { recursive: true });
	mkdirSync(artifactDirectory(root), { recursive: true });
	writeFileSync(
		join(artifactDirectory(root), "terrain-catalogue.json"),
		"{}",
	);
	writeFileSync(join(root, "data/build/datasets/sample.json"), payload);
	writeFileSync(
		join(root, "data/build/datasets/dataset-manifest.json"),
		JSON.stringify({
			version: 1,
			datasets: [
				{
					type: "sample",
					output: "sample",
					source: {},
					contract: {},
					summary: {},
					fingerprint: "v1",
					compiled: { bytes: Buffer.byteLength(payload), sha256 },
				},
			],
		}),
	);
	mkdirSync(join(root, "services/api/config"), { recursive: true });
	writeFileSync(
		join(root, "services/api/config/measure-dimensions.json"),
		JSON.stringify({
			schemaVersion: 1,
			measures: {},
			dimensions: {},
			members: {},
			defaults: {},
			ids: {},
		}),
	);
	mkdirSync(join(root, "data/build/geography"), { recursive: true });
	writeFileSync(
		join(root, "data/build/geography/boundary-releases.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "registry",
			releases: [],
		}),
	);
	writeFileSync(
		join(artifactDirectory(root), "area-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "areas",
			boundaryRegistryHash: "registry",
			releases: [],
		}),
	);

	writeFileSync(
		join(artifactDirectory(root), "crosswalk-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "crosswalks",
			crosswalks: [],
		}),
	);
	writeFileSync(
		join(artifactDirectory(root), "named-locations.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "locations",
			source: {
				artifact: "data/datasets/gazetteer.core.json",
				gazetteerVersion: 1,
			},
			locations: [],
		}),
	);
	mkdirSync(join(root, "data/build/location-projections"), {
		recursive: true,
	});
	writeFileSync(
		join(
			root,
			"data/build/location-projections/location-projection-inventory.json",
		),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "projections",
			namedLocationInventoryHash: "locations",
			crosswalkInventoryHash: "crosswalks",
			shards: [],
			parentShards: [],
		}),
	);
	buildAtlasSqlite(root, {
		unstored: { sample: "A fixture kept as a payload." },
		censusTables: [],
	});
	symlinkSync("atlas-base.sqlite", join(root, "data/build/atlas.sqlite"));
	// The request must work without either product's JSON copies.
	rmSync(join(root, "data/build/datasets"), { recursive: true });
	rmSync(artifactDirectory(root), { recursive: true });
	vi.spyOn(process, "cwd").mockReturnValue(root);
});
afterEach(() => {
	vi.restoreAllMocks();
	rmSync(root, { recursive: true, force: true });
});

describe("versioned dataset route", () => {
	it("serves exact JSON bytes with immutable caching at the server-provided URL", async () => {
		expect(readAtlasDatasetUrls(root)).toEqual({
			sample: `/data/catalogue/${sha256}/sample.json`,
		});
		const response = await request();
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(payload);
		expect(response.headers.get("Content-Type")).toBe(
			"application/json; charset=utf-8",
		);
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=31536000, immutable",
		);
		expect(response.headers.get("Vary")).toBe("Accept-Encoding");
	});
	it("leaves compression of uncached JSON to Next.js", async () => {
		const response = await request(sha256, "sample.json", {
			"Accept-Encoding": "gzip",
		});
		expect(response.headers.get("Content-Encoding")).toBeNull();
		expect(response.headers.get("Content-Length")).toBe(
			String(Buffer.byteLength(payload)),
		);
		expect(await response.text()).toBe(payload);
	});
	it.each(["gzip;q=0", "*;q=1, gzip;q=0", "br"])(
		"keeps identity JSON for %s",
		async (encoding) => {
			const response = await GET(
				new Request("http://localhost", {
					headers: { "Accept-Encoding": encoding },
				}),
				{ params: Promise.resolve({ sha256, output: "sample.json" }) },
			);
			expect(response.headers.get("Content-Encoding")).toBeNull();
			expect(await response.text()).toBe(payload);
		},
	);
	it.each([
		["0".repeat(64), "sample.json"],
		[sha256, "missing.json"],
		["invalid", "sample.json"],
		[sha256, "../sample.json"],
	])(
		"rejects a missing or mismatched version without immutable caching",
		async (hash, output) => {
			const response = await request(hash, output);
			expect(response.status).toBe(404);
			expect(response.headers.get("Cache-Control")).toBe("no-store");
		},
	);
});

describe("versioned dataset route with cached payloads", () => {
	beforeEach(cacheSample);
	it.each(["gzip", "br, gzip;q=0.5", "*"])(
		"sends the stored gzip bytes for %s",
		async (encoding) => {
			const response = await request(sha256, "sample.json", {
				"Accept-Encoding": encoding,
			});
			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Encoding")).toBe("gzip");
			expect(response.headers.get("Content-Length")).toBe(
				String(stored.byteLength),
			);
			expect(response.headers.get("Vary")).toBe("Accept-Encoding");
			expect(response.headers.get("Cache-Control")).toBe(
				"public, max-age=31536000, immutable",
			);
			expect(response.headers.get("ETag")).toBe(`W/"${sha256}"`);
			expect(response.headers.get("Content-Type")).toBe(
				"application/json; charset=utf-8",
			);
			const body = Buffer.from(await response.arrayBuffer());
			expect(body.equals(stored)).toBe(true);
			expect(gunzipSync(body).toString()).toBe(payload);
		},
	);
	it.each([undefined, "gzip;q=0", "*;q=1, gzip;q=0", "br"])(
		"sends identical plain JSON for %s",
		async (encoding) => {
			const response = await request(
				sha256,
				"sample.json",
				encoding ? { "Accept-Encoding": encoding } : {},
			);
			expect(response.headers.get("Content-Encoding")).toBeNull();
			expect(response.headers.get("Content-Length")).toBe(
				String(Buffer.byteLength(payload)),
			);
			expect(response.headers.get("Vary")).toBe("Accept-Encoding");
			expect(response.headers.get("ETag")).toBe(`W/"${sha256}"`);
			expect(await response.text()).toBe(payload);
		},
	);
	it.each([
		["0".repeat(64), "sample.json"],
		[sha256, "missing.json"],
	])("rejects stale hash %s without caching", async (hash, output) => {
		const response = await request(hash, output, {
			"Accept-Encoding": "gzip",
		});
		expect(response.status).toBe(404);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});
});
