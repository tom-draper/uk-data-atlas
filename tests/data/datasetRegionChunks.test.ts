import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
	REGION_CHUNK_KEYS,
	regionChunkPath,
	regionChunksForLocation,
} from "@/lib/data/datasetRegionChunks";

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
			"/data/precompiled/chunks/population/E12000002.json",
		);
	});

	it("keeps every population ward in one regional chunk", () => {
		const root = process.cwd();
		const populationPayload = JSON.parse(
			readFileSync(
				join(root, "data", "precompiled", "population.json"),
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
						"data",
						"precompiled",
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
