import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchOnsBoundary } from "../../../pipeline/src/sources/fetch-ons-boundaries";
import type { OnsBoundarySource } from "../../../pipeline/src/sources/onsBoundarySources";
import { createBoundaryRegistry } from "../../../pipeline/src/build-boundary-registry";
import { compileAreas } from "../../../pipeline/src/areaInventory";

const source: OnsBoundarySource = {
	geography: "seneddConstituency",
	release: "2026-05-w-bgc",
	itemId: "test-item",
	service: "test-boundaries",
	title: "Senedd constituencies, May 2026",
	count: 3,
	contentHash:
		"sha256:1a1dba46815f63bf8ef7b815563c23e055ef86c292ad290892e708b0f1c6d51e",
	codeProperty: "SENC26CD",
	nameProperty: "SENC26NM",
	countries: ["GB-WLS"],
};

const feature = (code: string) => ({
	type: "Feature",
	properties: { SENC26CD: code, SENC26NM: `Area ${code}` },
	geometry: {
		type: "Polygon",
		coordinates: [
			[
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 0],
			],
		],
	},
});

const fetcher = (
	features = [
		feature("W09000001"),
		feature("W09000002"),
		feature("W09000003"),
	],
) => {
	const urls: URL[] = [];
	const request: typeof fetch = async (input) => {
		const url = new URL(String(input));
		urls.push(url);
		const body = !url.pathname.endsWith("/query")
			? {
					geometryType: "esriGeometryPolygon",
					objectIdField: "FID",
					maxRecordCount: 2,
					editingInfo: { dataLastEditDate: 12345 },
				}
			: url.searchParams.has("returnCountOnly")
				? { count: 3 }
				: {
						type: "FeatureCollection",
						features: features.slice(
							Number(url.searchParams.get("resultOffset")),
							Number(url.searchParams.get("resultOffset")) + 2,
						),
					};
		return new Response(JSON.stringify(body));
	};
	return { request, urls };
};

test("downloads every page and compiles the resulting boundary snapshot", async (context) => {
	const repositoryRoot = mkdtempSync(join(tmpdir(), "atlas-ons-boundaries-"));
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request, urls } = fetcher();
	const result = await fetchOnsBoundary({
		repositoryRoot,
		source,
		fetcher: request,
		retrieved: "2026-10-19",
	});
	assert.equal(result.count, 3);
	assert.equal(statSync(join(result.path, "..")).mode & 0o777, 0o755);
	assert.deepEqual(
		JSON.parse(readFileSync(join(result.path, "..", "meta.json"), "utf8"))
			.publisherRevision,
		{ dataLastEditDate: 12345 },
	);
	const raw = readFileSync(result.path, "utf8");
	assert.deepEqual(JSON.parse(raw).features, [
		feature("W09000001"),
		feature("W09000002"),
		feature("W09000003"),
	]);
	const pages = urls.filter((url) => url.searchParams.has("resultOffset"));
	assert.deepEqual(
		pages.map((url) => url.searchParams.get("resultOffset")),
		["0", "2"],
	);
	assert.deepEqual(
		pages.map((url) => url.searchParams.get("outSR")),
		["4326", "4326"],
	);
	assert.deepEqual(
		pages.map((url) => url.searchParams.get("orderByFields")),
		["FID", "FID"],
	);
	const registry = createBoundaryRegistry(repositoryRoot);
	const compiled = compileAreas(repositoryRoot, registry);
	assert.equal(registry.releases[0].id, "2026-05-w-bgc");
	assert.deepEqual(compiled.artifacts[0].areas, [
		{ code: "W09000001", name: "Area W09000001" },
		{ code: "W09000002", name: "Area W09000002" },
		{ code: "W09000003", name: "Area W09000003" },
	]);
	const repeated = await fetchOnsBoundary({
		repositoryRoot,
		source,
		fetcher: request,
		retrieved: "2026-10-20",
	});
	assert.equal(readFileSync(repeated.path, "utf8"), raw);
	assert.equal(
		JSON.parse(readFileSync(join(result.path, "..", "meta.json"), "utf8"))
			.retrieved,
		"2026-10-19",
	);
});

test("rejects duplicates and missing geometry without publishing a snapshot", async (context) => {
	const repositoryRoot = mkdtempSync(
		join(tmpdir(), "atlas-ons-boundaries-invalid-"),
	);
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	for (const features of [
		[feature("W09000001"), feature("W09000001"), feature("W09000003")],
		[
			feature("W09000001"),
			{ ...feature("W09000002"), geometry: null },
			feature("W09000003"),
		],
	]) {
		const request: typeof fetch = async (input) => {
			const url = new URL(String(input));
			return new Response(
				JSON.stringify(
					!url.pathname.endsWith("/query")
						? {
								geometryType: "esriGeometryPolygon",
								objectIdField: "FID",
								maxRecordCount: 1000,
							}
						: url.searchParams.has("returnCountOnly")
							? { count: 3 }
							: { type: "FeatureCollection", features },
				),
			);
		};
		await assert.rejects(
			fetchOnsBoundary({ repositoryRoot, source, fetcher: request }),
			/duplicate|geometry/i,
		);
		assert.deepEqual(
			readdirSync(
				join(
					repositoryRoot,
					"data/source",
					"boundaries",
					"senedd-constituency",
				),
			),
			[],
		);
	}
});

test("rejects a changed publisher count before downloading pages", async (context) => {
	const repositoryRoot = mkdtempSync(
		join(tmpdir(), "atlas-ons-boundaries-count-"),
	);
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request, urls } = fetcher();
	await assert.rejects(
		fetchOnsBoundary({
			repositoryRoot,
			source: { ...source, count: 4 },
			fetcher: request,
		}),
		/expected 4.*3/i,
	);
	assert.equal(
		urls.some((url) => url.searchParams.has("resultOffset")),
		false,
	);
	assert.equal(
		existsSync(join(repositoryRoot, "data/source", "boundaries")),
		false,
	);
});

test("removes partial pages after a failed download", async (context) => {
	const repositoryRoot = mkdtempSync(
		join(tmpdir(), "atlas-ons-boundaries-failure-"),
	);
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request } = fetcher();
	const failed: typeof fetch = async (input, options) => {
		if (new URL(String(input)).searchParams.get("resultOffset") === "2")
			return new Response("unavailable", { status: 503 });
		return request(input, options);
	};
	await assert.rejects(
		fetchOnsBoundary({
			repositoryRoot,
			source,
			fetcher: failed,
			retryDelay: 0,
		}),
		/HTTP 503/,
	);
	assert.deepEqual(
		readdirSync(
			join(
				repositoryRoot,
				"data/source",
				"boundaries",
				"senedd-constituency",
			),
		),
		[],
	);
});

test("retries dropped connections and server errors", async (context) => {
	const repositoryRoot = mkdtempSync(join(tmpdir(), "atlas-ons-retry-"));
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request } = fetcher();
	const failures = new Map<string, number>();
	const flaky: typeof fetch = async (input, options) => {
		const offset = new URL(String(input)).searchParams.get("resultOffset");
		if (offset !== null) {
			const failed = failures.get(offset) ?? 0;
			failures.set(offset, failed + 1);
			if (failed === 0) throw new TypeError("fetch failed");
			if (failed === 1) return new Response("busy", { status: 503 });
		}
		return request(input, options);
	};
	const result = await fetchOnsBoundary({
		repositoryRoot,
		source,
		fetcher: flaky,
		retryDelay: 0,
	});
	assert.equal(result.contentHash, source.contentHash);
	assert.deepEqual([...failures.values()], [3, 3]);
});

test("does not replace an existing snapshot with changed source bytes", async (context) => {
	const repositoryRoot = mkdtempSync(
		join(tmpdir(), "atlas-ons-boundaries-existing-"),
	);
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request } = fetcher();
	const result = await fetchOnsBoundary({
		repositoryRoot,
		source,
		fetcher: request,
	});
	const original = readFileSync(result.path, "utf8");
	const changedFeatures = [
		feature("W09000001"),
		feature("W09000002"),
		{
			...feature("W09000003"),
			properties: { SENC26CD: "W09000003", SENC26NM: "Changed" },
		},
	];
	const changed = fetcher(changedFeatures);
	const contentHash: `sha256:${string}` = `sha256:${createHash("sha256")
		.update(
			JSON.stringify({
				type: "FeatureCollection",
				features: changedFeatures,
			}),
		)
		.digest("hex")}`;
	await assert.rejects(
		fetchOnsBoundary({
			repositoryRoot,
			source: { ...source, contentHash },
			fetcher: changed.request,
		}),
		/different source bytes/,
	);
	assert.equal(readFileSync(result.path, "utf8"), original);
	assert.deepEqual(readdirSync(join(result.path, "../..")), [source.release]);
});

test("rejects changed publisher bytes even when every code and the count match", async (context) => {
	const repositoryRoot = mkdtempSync(
		join(tmpdir(), "atlas-ons-boundaries-hash-"),
	);
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request } = fetcher();
	await assert.rejects(
		fetchOnsBoundary({
			repositoryRoot,
			source: { ...source, contentHash: "sha256:reviewed-other-bytes" },
			fetcher: request,
		}),
		/publisher geometry changed/,
	);
	assert.deepEqual(
		readdirSync(
			join(
				repositoryRoot,
				"data/source",
				"boundaries",
				"senedd-constituency",
			),
		),
		[],
	);
});

test("rejects publisher changes during acquisition and removes staging", async (context) => {
	const repositoryRoot = mkdtempSync(join(tmpdir(), "atlas-ons-changing-"));
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	for (const change of ["count", "revision"]) {
		const { request } = fetcher();
		let metadataReads = 0;
		let countReads = 0;
		const changing: typeof fetch = async (input, options) => {
			const url = new URL(String(input));
			if (
				!url.pathname.endsWith("/query") &&
				++metadataReads === 2 &&
				change === "revision"
			)
				return Response.json({
					editingInfo: { dataLastEditDate: 99999 },
				});
			if (
				url.searchParams.has("returnCountOnly") &&
				++countReads === 2 &&
				change === "count"
			)
				return Response.json({ count: 4 });
			return request(input, options);
		};
		await assert.rejects(
			fetchOnsBoundary({ repositoryRoot, source, fetcher: changing }),
			/changed during download/,
		);
		assert.deepEqual(
			readdirSync(
				join(
					repositoryRoot,
					"data/source/boundaries/senedd-constituency",
				),
			),
			[],
		);
	}
});

test("refuses an existing snapshot with missing or changed provenance", async (context) => {
	const repositoryRoot = mkdtempSync(join(tmpdir(), "atlas-ons-provenance-"));
	context.after(() =>
		rmSync(repositoryRoot, { recursive: true, force: true }),
	);
	const { request } = fetcher();
	const result = await fetchOnsBoundary({
		repositoryRoot,
		source,
		fetcher: request,
	});
	const metadataPath = join(result.path, "..", "meta.json");
	writeFileSync(
		metadataPath,
		JSON.stringify({ sourceUrl: "https://example.com/other-source" }),
	);
	await assert.rejects(
		fetchOnsBoundary({ repositoryRoot, source, fetcher: request }),
		/different source bytes or provenance/,
	);
	rmSync(metadataPath);
	await assert.rejects(
		fetchOnsBoundary({ repositoryRoot, source, fetcher: request }),
		/without source metadata/,
	);
	assert.equal(existsSync(result.path), true);
});
