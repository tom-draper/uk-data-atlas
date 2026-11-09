import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codeListId } from "@uk-data-atlas/map-tiles/mapValues";
import { mapValuesRequestFor } from "@/lib/data/mapValues/request";
import type { BoundaryTiles } from "@/lib/data/boundaries/tiles";

const codeList = ["E06000001", "E06000002", "E06000003"];
const tiles: BoundaryTiles = {
	href: "/x.pmtiles",
	minZoom: 0,
	maxZoom: 12,
	codeKey: "LAD25CD",
	release: "localAuthority/r1",
	codeList,
	ids: new Map(codeList.map((code, index) => [code, index + 1])),
};

describe("mapValuesRequestFor", () => {
	const dataset = { type: "councilTax", year: 2025 };

	it("asks for the array of a plain field on tiles", () => {
		expect(
			mapValuesRequestFor(dataset, tiles, { valueKey: "value" }),
		).toEqual({
			measure: "councilTax",
			field: "value",
			release: "localAuthority/r1",
			year: 2025,
			codeList,
		});
	});

	it("keeps the join without tiles, a field, or for a derived value", () => {
		expect(
			mapValuesRequestFor(dataset, undefined, { valueKey: "value" }),
		).toBeNull();
		expect(mapValuesRequestFor(dataset, tiles, {})).toBeNull();
		expect(
			mapValuesRequestFor(dataset, tiles, {
				valueKey: "value",
				valueFor: () => 1,
			}),
		).toBeNull();
		expect(
			mapValuesRequestFor(dataset, tiles, {
				valueKey: "value",
				sourceMode: () => "a",
			}),
		).toBeNull();
		expect(
			mapValuesRequestFor(dataset, tiles, {
				valueKey: "value",
				getColorRange: () => ({ min: 0, max: 1 }),
			}),
		).toBeNull();
	});
});

describe("fetchMapValues", () => {
	const manifest = (
		version = codeListId(codeList).version,
		field = "value",
	) => ({
		schemaVersion: 1,
		entries: {
			"councilTax/localAuthority/r1/2025": {
				file: "councilTax/localAuthority/r1/2025.abc.json",
				field,
				bytes: 10,
				sha256: "",
				codeList: { count: 3, version },
				valueCount: 2,
			},
		},
	});
	const request = {
		measure: "councilTax",
		field: "value",
		release: "localAuthority/r1",
		year: 2025,
		codeList,
	};
	const answer = (body: unknown, status = 200) =>
		new Response(typeof body === "string" ? body : JSON.stringify(body), {
			status,
		});

	// The loader keeps the manifest, so each case loads a fresh copy of it.
	const load = async () =>
		(await import("@/lib/data/mapValues/mapValues")).fetchMapValues;
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.unstubAllGlobals());

	it("reads the array for a matching code list", async () => {
		const fetchMock = vi.fn(async (url: string) =>
			url.includes("manifest")
				? answer(manifest())
				: answer("[1,null,3]"),
		);
		vi.stubGlobal("fetch", fetchMock);
		const fetchMapValues = await load();
		expect(await fetchMapValues(request)).toEqual([1, null, 3]);
		await fetchMapValues(request);
		// The manifest and the array are each fetched once.
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("is null when the build made no array, or one from another field", async () => {
		vi.stubGlobal("fetch", async () => answer(manifest()));
		const fetchMapValues = await load();
		expect(await fetchMapValues({ ...request, year: 1999 })).toBeNull();
		expect(await fetchMapValues({ ...request, field: "other" })).toBeNull();
	});

	it("is null when the build has no manifest", async () => {
		vi.stubGlobal("fetch", async () => answer("", 404));
		expect(await (await load())(request)).toBeNull();
	});

	it("rejects an array made for another code list", async () => {
		vi.stubGlobal("fetch", async (url: string) =>
			url.includes("manifest")
				? answer(manifest(codeListId([...codeList].reverse()).version))
				: answer("[1,2,3]"),
		);
		// A reset module graph has its own error class, so match by name.
		await expect((await load())(request)).rejects.toMatchObject({
			name: "MapValuesMismatchError",
		});
	});
});
