import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/data/catalogue/[sha256]/[output]/route";
import { buildAtlasSqlite } from "@/pipeline/src/buildAtlasSqlite";
import { readAtlasDatasetUrls } from "@uk-data-atlas/atlas-runtime/storage";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

let root: string;
const payload = '{"2024":{"value":42}}\n';
const sha256 = createHash("sha256").update(payload).digest("hex");
const request = (hash = sha256, output = "sample.json") =>
	GET(new Request("http://localhost/data/catalogue"), {
		params: Promise.resolve({ sha256: hash, output }),
	});

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
					type: "historicalGeneralElection",
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
	buildAtlasSqlite(root);
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
	it.each(["gzip", "br, gzip;q=0.5", "*"])(
		"compresses JSON for %s",
		async (encoding) => {
			const response = await GET(
				new Request("http://localhost", {
					headers: { "Accept-Encoding": encoding },
				}),
				{ params: Promise.resolve({ sha256, output: "sample.json" }) },
			);
			expect(response.headers.get("Content-Encoding")).toBe("gzip");
			expect(
				gunzipSync(
					Buffer.from(await response.arrayBuffer()),
				).toString(),
			).toBe(payload);
		},
	);
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
