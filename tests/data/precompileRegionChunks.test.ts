import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { expect, it } from "vitest";
import { writeDatasetRegionChunks } from "../../scripts/dataset-region-chunks.mjs";
import type { DatasetPayloadLayout } from "@uk-data-atlas/datasets/data/catalog/types";

it("loads regional payloads only when writing their chunks", async () => {
	const root = await mkdtemp(join(tmpdir(), "precompile-chunks-"));
	const layout: DatasetPayloadLayout = {
		regionChunks: { kind: "regional" },
	};
	const payload = {
		"2025": {
			data: {
				S01: { ladCode: "S12000001", value: 10 },
				W01: { ladCode: "W06000001", value: 20 },
			},
			results: { S01: [10], W01: [20] },
		},
	};
	const chunkPath = (file: string, region: string) =>
		join(
			root,
			"public",
			"data",
			"datasets",
			"chunks",
			file,
			`${region}.json`,
		);
	const loaded: string[] = [];
	try {
		await writeDatasetRegionChunks({
			root,
			core: { version: 1, byCode: {}, nameIndex: {}, namedLocations: {} },
			datasets: new Map([
				[
					"first",
					{
						layout,
						load: async () => {
							loaded.push("first");
							return payload;
						},
					},
				],
				[
					"second",
					{
						layout,
						load: async () => {
							expect(
								JSON.parse(
									await readFile(
										chunkPath("first", "Wales"),
										"utf8",
									),
								),
							).toEqual({
								"2025": {
									data: { W01: payload["2025"].data.W01 },
									results: { W01: [20] },
								},
							});
							loaded.push("second");
							return payload;
						},
					},
				],
				[
					"unchunked",
					{
						load: async () => {
							throw new Error(
								"Unchunked payload should not be loaded",
							);
						},
					},
				],
			]),
		});
		expect(loaded).toEqual(["first", "second"]);
		expect(
			JSON.parse(await readFile(chunkPath("second", "Scotland"), "utf8")),
		).toEqual({
			"2025": {
				data: { S01: payload["2025"].data.S01 },
				results: { S01: [10] },
			},
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
