import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({ readFile }));

const index = {
	version: 1,
	contentHash: "sha256:fixture",
	releases: {},
	areas: [["E06000063", "Cumberland", "localAuthority", null, 2023, null]],
	named: [["cumbria", "Cumbria", "county", null, 0, null]],
};
const pages = join(process.cwd(), "public", "data", "atlas-pages");

// Each test gets fresh modules, so no page is already cached.
const load = () => import("@/lib/places/load");
beforeEach(() => vi.resetModules());
afterEach(() => {
	readFile.mockReset();
	vi.unstubAllGlobals();
});

describe("place data reads", () => {
	it("reads index and profile shards from the website's own copy", async () => {
		const profile = { type: "area", code: "E06000063" };
		readFile.mockImplementation(async (path: string) =>
			JSON.stringify(
				path.includes("places-index") ? index : { E06000063: profile },
			),
		);
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		const { loadAreaProfile } = await load();
		expect(await loadAreaProfile("E06000063")).toEqual(profile);
		expect(readFile.mock.calls.map(([path]) => path)).toEqual([
			join(pages, "places-index.json"),
			join(pages, "places-area-E060000.json"),
		]);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("returns missing only when the index excludes the place", async () => {
		readFile.mockResolvedValue(JSON.stringify(index));
		const { loadNamedProfile } = await load();
		expect(await loadNamedProfile("unknown")).toBeUndefined();
		expect(readFile).toHaveBeenCalledTimes(1);
	});

	it("reports a missing copy and permits a later retry", async () => {
		readFile
			.mockRejectedValueOnce(new Error("ENOENT"))
			.mockResolvedValueOnce(JSON.stringify(index));
		const { placeEntry } = await load();
		await expect(placeEntry("E06000063")).rejects.toThrow(
			"pnpm atlas-data:copy",
		);
		expect((await placeEntry("E06000063"))?.[1]).toBe("Cumberland");
	});

	it("rejects an id that would leave the pages directory", async () => {
		const { readAtlasPage } = await import("@/lib/helpers/atlasPages");
		await expect(readAtlasPage("../secret")).rejects.toThrow("Invalid");
		expect(readFile).not.toHaveBeenCalled();
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
