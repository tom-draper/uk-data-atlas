import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
	REGION_CHUNK_KEYS,
	regionChunkPath,
	regionChunksForLocation,
	regionForLadIn,
} from "@/lib/data/datasetRegionChunks";
import { gazetteer } from "@/lib/data/gazetteer/static";

describe("dataset region chunks", () => {
	it("uses the North West chunk for Greater Manchester", () => {
		expect(regionChunksForLocation("Greater Manchester")).toEqual([
			"E12000002",
		]);
	});

	it("uses every region chunk for the United Kingdom", () => {
		expect(regionChunksForLocation("United Kingdom")).toEqual(
			REGION_CHUNK_KEYS,
		);
	});

	it("falls back for an unknown location", () => {
		expect(regionChunksForLocation("Unknown")).toBeNull();
	});

	it("uses the static chunk path", () => {
		expect(regionChunkPath("population", "E12000002")).toBe(
			"/data/datasets/chunks/population/E12000002.json",
		);
	});

	// The browser fetches a location's region chunks and then filters them by
	// the LSOA → LAD lookup for the dataset's boundary year. A chunk therefore
	// has to hold every LSOA the lookup puts in a local authority of its region.
	it("places every IMD LSOA in its local authority's region", () => {
		const file = "imd";
		const edition = "2025";
		const datasets = join(process.cwd(), "public", "data", "datasets");
		const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
		const full = read(join(datasets, `${file}.json`))[edition] as {
			boundaryYear: number;
			data: Record<string, unknown>;
		};
		const { lsoaToLad } = read(
			join(datasets, `lsoa-lad-mappings-${full.boundaryYear}.json`),
		) as { lsoaToLad: Record<string, string> };

		const chunkOf = new Map<string, string>();
		for (const region of REGION_CHUNK_KEYS) {
			const chunk = read(
				join(datasets, "chunks", file, `${region}.json`),
			)[edition] as { data: Record<string, unknown> };
			for (const code of Object.keys(chunk.data)) {
				expect(chunkOf.has(code)).toBe(false);
				chunkOf.set(code, region);
			}
		}

		expect(new Set(chunkOf.keys())).toEqual(
			new Set(Object.keys(full.data)),
		);
		const misplaced = Object.keys(full.data).filter((code) => {
			const lad = lsoaToLad[code];
			return (
				lad !== undefined &&
				chunkOf.get(code) !== regionForLadIn(gazetteer, lad)
			);
		});
		expect(misplaced).toEqual([]);
	});

	it("keeps every population ward in one regional chunk", () => {
		const root = process.cwd();
		const populationPayload = JSON.parse(
			readFileSync(
				join(root, "public", "data", "datasets", "population.json"),
				"utf8",
			),
		) as Record<string, { data: Record<string, unknown> }>;
		const population = populationPayload["2022"]!.data;
		const chunkCodes = new Set<string>();
		for (const region of REGION_CHUNK_KEYS) {
			const chunkPayload = JSON.parse(
				readFileSync(
					join(
						root,
						"public",
						"data",
						"datasets",
						"chunks",
						"population",
						`${region}.json`,
					),
					"utf8",
				),
			) as Record<string, { data: Record<string, unknown> }>;
			const chunk = chunkPayload["2022"]!.data;
			for (const code of Object.keys(chunk)) {
				expect(chunkCodes.has(code)).toBe(false);
				chunkCodes.add(code);
			}
		}
		expect(chunkCodes).toEqual(new Set(Object.keys(population)));
	});
});
