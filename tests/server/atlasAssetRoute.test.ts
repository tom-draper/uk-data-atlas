import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as page } from "@/app/data/atlas-pages/[file]/route";
import { GET as lookup } from "@/app/data/atlas-lookups/[file]/route";
import { buildAtlasAssets } from "@/pipeline/src/build-atlas-assets";
import { readAtlasAssetText } from "@uk-data-atlas/atlas-runtime/storage";
import { websiteAssetsFixture } from "@/tests/fixtures/websiteAssets";

let fixture: ReturnType<typeof websiteAssetsFixture>;
const request = (file = "places-index.json", headers: HeadersInit = {}) =>
	page(
		new Request("http://localhost/data/atlas-pages/" + file, { headers }),
		{ params: Promise.resolve({ file }) },
	);
beforeEach(() => {
	fixture = websiteAssetsFixture({
		"places-index": { value: 42 },
		obsolete: { value: 1 },
	});
	vi.spyOn(process, "cwd").mockReturnValue(fixture.root);
});
afterEach(() => {
	vi.restoreAllMocks();
	rmSync(fixture.root, { recursive: true, force: true });
});

describe("SQLite website assets", () => {
	it("serves exact page and lookup payloads without public copies or API files", async () => {
		rmSync(join(fixture.root, "data/build/atlas-assets"), {
			recursive: true,
		});
		expect(existsSync(join(fixture.root, "public/data/atlas-pages"))).toBe(
			false,
		);
		const response = await request();
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('{"value":42}');
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=0, must-revalidate",
		);
		const mapping = await lookup(new Request("http://localhost"), {
			params: Promise.resolve({ file: "boundary-mappings.json" }),
		});
		expect(await mapping.json()).toEqual({
			lookup: "boundary-mappings.json",
		});
	});
	it.each(["gzip", "br, gzip;q=0.5", "*"])(
		"serves stored gzip for %s",
		async (encoding) => {
			const response = await request(undefined, {
				"Accept-Encoding": encoding,
			});
			expect(response.headers.get("Content-Encoding")).toBe("gzip");
			expect(
				gunzipSync(
					Buffer.from(await response.arrayBuffer()),
				).toString(),
			).toBe('{"value":42}');
		},
	);
	it("honours explicit gzip refusal", async () => {
		const response = await request(undefined, {
			"Accept-Encoding": "*;q=1, gzip;q=0",
		});
		expect(response.headers.get("Content-Encoding")).toBeNull();
		expect(await response.json()).toEqual({ value: 42 });
	});
	it("revalidates unchanged content without a response body", async () => {
		const initial = await request();
		const etag = initial.headers.get("ETag")!;
		const response = await request(undefined, {
			"If-None-Match": `"other", ${etag}`,
		});
		expect(response.status).toBe(304);
		expect(await response.text()).toBe("");
		expect(response.headers.get("Vary")).toBe("Accept-Encoding");
	});
	it.each([
		"missing.json",
		"../secret.json",
		"places-index",
		"places-index.json.gz",
	])("returns an uncached 404 for %s", async (file) => {
		const response = await request(file);
		expect(response.status).toBe(404);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});
	it("keeps the database unchanged on an identical import", () => {
		const path = join(fixture.root, "data/build/atlas.sqlite");
		const before = statSync(path);
		buildAtlasAssets(fixture.root);
		expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
	});
	it("replaces removed assets and preserves other database tables", () => {
		fixture.write("pages", {
			"docs-catalogue": {},
			"place-facts": {},
			"places-index": { value: 43 },
			"ward-areas": {},
		});
		buildAtlasAssets(fixture.root);
		expect(readAtlasAssetText(fixture.root, "pages", "places-index")).toBe(
			'{"value":43}',
		);
		expect(() =>
			readAtlasAssetText(fixture.root, "pages", "obsolete"),
		).toThrow("Missing");
		const database = new DatabaseSync(
			join(fixture.root, "data/build/atlas.sqlite"),
			{ readOnly: true },
		);
		try {
			expect(
				database
					.prepare(
						"SELECT payload FROM payloads WHERE id = 'fixture'",
					)
					.get()?.payload,
			).toBe("preserved");
		} finally {
			database.close();
		}
	});
	it("validates every input before replacing data or removing old copies", () => {
		const path = join(
			fixture.root,
			"data/build/atlas-assets/atlas-pages/places-index.json.gz",
		);
		writeFileSync(path, "corrupt gzip");
		const legacy = join(fixture.root, "public/data/precompiled");
		mkdirSync(legacy, { recursive: true });
		writeFileSync(join(legacy, "old.json"), "{}");
		expect(() => buildAtlasAssets(fixture.root)).toThrow();
		expect(readAtlasAssetText(fixture.root, "pages", "places-index")).toBe(
			'{"value":42}',
		);
		expect(readFileSync(join(legacy, "old.json"), "utf8")).toBe("{}");
	});
	it("cleans legacy copies after successful import", () => {
		for (const directory of ["atlas-pages", "atlas-lookups", "precompiled"])
			mkdirSync(join(fixture.root, "public/data", directory), {
				recursive: true,
			});
		buildAtlasAssets(fixture.root);
		for (const directory of ["atlas-pages", "atlas-lookups", "precompiled"])
			expect(
				existsSync(join(fixture.root, "public/data", directory)),
			).toBe(false);
	});
});
