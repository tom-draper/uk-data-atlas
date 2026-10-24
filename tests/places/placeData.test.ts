import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { websiteAssetsFixture } from "@/tests/fixtures/websiteAssets";
import { buildWebsiteAssets } from "@/scripts/build-website-assets";

const index = {
	version: 1,
	contentHash: "sha256:fixture",
	releases: {},
	areas: [["E06000063", "Cumberland", "localAuthority", null, 2023, null]],
	named: [["cumbria", "Cumbria", "county", null, 0, null]],
};

let fixture: ReturnType<typeof websiteAssetsFixture>;
const profile = { type: "area", code: "E06000063" };
const load = () => import("@/lib/places/load");
beforeEach(() => {
	vi.resetModules();
	fixture = websiteAssetsFixture({
		"places-index": index,
		"places-area-E060000": { E06000063: profile },
	});
	vi.spyOn(process, "cwd").mockReturnValue(fixture.root);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	rmSync(fixture.root, { recursive: true, force: true });
});

describe("place data reads", () => {
	it("reads index and profiles from SQLite without public copies or a running API", async () => {
		rmSync(join(fixture.root, "services"), { recursive: true });
		vi.stubGlobal(
			"fetch",
			vi.fn(() => {
				throw new Error("Unexpected network request");
			}),
		);
		const { loadAreaProfile } = await load();
		expect(await loadAreaProfile("E06000063")).toEqual(profile);
	});
	it("returns missing when the index excludes the place", async () => {
		const { loadNamedProfile } = await load();
		expect(await loadNamedProfile("unknown")).toBeUndefined();
	});
	it("permits a retry after a missing asset is restored", async () => {
		const { readAtlasPage } = await import("@/lib/helpers/atlasPages");
		await expect(readAtlasPage("restored")).rejects.toThrow(
			"website-lookups",
		);
		fixture.write("pages", {
			"docs-catalogue": {},
			"place-facts": {},
			"places-index": index,
			"ward-areas": {},
			restored: { value: 42 },
		});
		buildWebsiteAssets(fixture.root);
		expect(await readAtlasPage("restored")).toEqual({ value: 42 });
	});
	it("rejects an invalid asset id", async () => {
		const { readAtlasPage } = await import("@/lib/helpers/atlasPages");
		await expect(readAtlasPage("../secret")).rejects.toThrow("Invalid");
	});
});

describe("place data in the browser", () => {
	it("fetches from the website, not the API", async () => {
		const fetcher = vi.fn(async () => Response.json(index));
		vi.stubGlobal("fetch", fetcher);
		const { fetchAtlasPage } = await import("@/lib/helpers/atlasData");
		await fetchAtlasPage("places-index");
		expect(fetcher).toHaveBeenCalledWith(
			"/data/atlas-pages/places-index.json",
		);
	});

	it("does not parse a failed download as a page", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 404 })),
		);
		const { fetchAtlasPage } = await import("@/lib/helpers/atlasData");
		await expect(fetchAtlasPage("docs-catalogue")).rejects.toThrow(
			"HTTP 404",
		);
	});
});
