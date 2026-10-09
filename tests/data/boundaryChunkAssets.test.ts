import { readFileSync } from "fs";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import {
	boundaryChunkRegions,
	fetchBoundaryGeometry,
} from "@/lib/data/boundaries/chunks";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import { filterFeatures } from "@/lib/data/boundaries/filter";
import { getProp } from "@/lib/data/boundaries/properties";
import { lsoaYearForBoundaryAsset } from "@/lib/data/boundaries/lsoaLadMappings";
import { boundaryChunkProblems } from "../../scripts/boundary-chunks";

const PUBLIC = join(process.cwd(), "public");
const read = (path: string) =>
	JSON.parse(readFileSync(join(PUBLIC, path.split("?")[0]!), "utf8"));

// Places spanning one region, several regions and a region with no wards.
const LOCATIONS = [
	"Greater Manchester",
	"London",
	"West Midlands",
	"Cornwall",
	"Denbighshire",
	"The Highlands",
];

beforeAll(() => {
	vi.stubGlobal("fetch", async (url: string) => {
		try {
			const contents = read(url);
			return { ok: true, json: async () => contents };
		} catch {
			return { ok: false, status: 404, statusText: "Not Found" };
		}
	});
});
afterAll(() => vi.unstubAllGlobals());

describe("committed boundary chunks", () => {
	it("were cut from the releases, lookups and code in the repository", async () => {
		expect(await boundaryChunkProblems(process.cwd())).toEqual([]);
	});

	it.each([
		["ward", "newest-but-one", BOUNDARY_CATALOG.ward.releases[1]!],
		["ward", "oldest", BOUNDARY_CATALOG.ward.releases.at(-1)!],
		["lsoa", "newest", BOUNDARY_CATALOG.lsoa.releases[0]!],
	] as const)(
		"give a location the features the whole %s release does (%s)",
		async (type, _label, release) => {
			const asset = release.asset!;
			const whole = decodeBoundaryData(read(asset));
			const wardToLad = read(
				"/data/datasets/boundary-mappings.json",
			).wardToLad;
			const lsoaToLad =
				type === "lsoa"
					? read(
							`/data/datasets/lsoa-lad-mappings-${lsoaYearForBoundaryAsset(asset)}.json`,
						).lsoaToLad
					: undefined;
			const filter = (data: typeof whole, location: string) =>
				filterFeatures(data, {
					location,
					type,
					relations: {
						getLadForWard: data.features.some(
							(feature) =>
								!getProp(
									feature.properties,
									BOUNDARY_CATALOG.ward.properties
										.parentCode ??
										BOUNDARY_CATALOG.localAuthority
											.properties.code,
								),
						)
							? (code) => wardToLad[code]
							: undefined,
						lsoaToLad,
					},
				});

			for (const location of LOCATIONS) {
				const regions = boundaryChunkRegions(type, location, true);
				expect(regions, location).not.toBeNull();
				const chunked = await fetchBoundaryGeometry(asset, regions);
				expect(chunked.features.length).toBeLessThan(
					whole.features.length,
				);
				expect(filter(chunked, location).features, location).toEqual(
					filter(whole, location).features,
				);
			}
		},
		60_000,
	);
});
