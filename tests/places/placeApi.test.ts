import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAtlasPage, ATLAS_API_ORIGIN } from "@/lib/helpers/atlasApi";
import {
	loadAreaProfile,
	loadNamedProfile,
	placeEntry,
} from "@/lib/places/load";

const index = {
	version: 1,
	contentHash: "sha256:fixture",
	releases: {},
	areas: [["E06000063", "Cumberland", "localAuthority", null, 2023, null]],
	named: [["cumbria", "Cumbria", "county", null, 0, null]],
};
afterEach(() => vi.unstubAllGlobals());

describe("API-backed place reads", () => {
	it("reads index and profile shards from the configured API", async () => {
		const profile = { type: "area", code: "E06000063" };
		const fetcher = vi.fn(async (url: string) =>
			Response.json(
				url.includes("places-index") ? index : { E06000063: profile },
			),
		);
		vi.stubGlobal("fetch", fetcher);
		expect(await loadAreaProfile("E06000063")).toEqual(profile);
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
			`${ATLAS_API_ORIGIN}/v1/atlas-pages/places-index.json`,
			`${ATLAS_API_ORIGIN}/v1/atlas-pages/places-area-E060000.json`,
		]);
	});
	it("returns missing only when a successful index excludes the place", async () => {
		const fetcher = vi.fn(async () => Response.json(index));
		vi.stubGlobal("fetch", fetcher);
		expect(await loadNamedProfile("unknown")).toBeUndefined();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it("propagates an API failure and permits a later retry", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(new Response("", { status: 503 }))
				.mockResolvedValueOnce(Response.json(index)),
		);
		await expect(placeEntry("E06000063")).rejects.toThrow("HTTP 503");
		expect((await placeEntry("E06000063"))?.[1]).toBe("Cumberland");
	});
	it("does not parse a failed download as a catalogue", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 404 })),
		);
		await expect(fetchAtlasPage("docs-catalogue")).rejects.toThrow(
			"HTTP 404",
		);
	});
});
