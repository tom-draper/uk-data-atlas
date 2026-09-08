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
});
