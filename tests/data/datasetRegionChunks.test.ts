import { readFileSync } from "fs";
import { join } from "path";
import { isDeepStrictEqual } from "util";
import { describe, expect, it } from "vitest";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog";
import { decodeCompactPayload } from "@/lib/data/compactPayload";
import { mergeDatasetPayloads } from "@/lib/data/mergeDatasetPayloads";
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

	// Every dataset that is served in chunks. The chunks must be a partition of
	// the whole file: merged and expanded the way the worker does, they hold
	// every record once, exactly as the file does.
	const chunked = CATALOGUE_DATASET_DEFINITIONS.filter(
		(definition) => definition.payload?.regionChunks?.kind === "regional",
	);
	const datasets = join(process.cwd(), "public", "data", "datasets");
	const readJson = (...path: string[]) =>
		JSON.parse(readFileSync(join(datasets, ...path), "utf8"));

	// Local election records for a county council, or whose council is
	// "Unknown", have no region to be placed in, so they are in no chunk and
	// only the whole file holds them. Known, and out of scope here.
	const OMITS_UNPLACEABLE_RECORDS = new Set(["local-election"]);

	it.each(chunked.map((definition) => definition.precompiledFile))(
		"keeps every %s record in one chunk, and in the file's form",
		(file) => {
			const whole = decodeCompactPayload(
				readJson(`${file}.json`),
			) as Record<string, { data: Record<string, unknown> }>;
			const chunks = REGION_CHUNK_KEYS.map((region) =>
				readJson("chunks", file, `${region}.json`),
			);
			const complete = !OMITS_UNPLACEABLE_RECORDS.has(file);
			for (const edition of Object.keys(whole)) {
				const seen = new Set<string>();
				for (const chunk of chunks)
					for (const code of Object.keys(chunk[edition].data)) {
						expect(seen.has(code)).toBe(false);
						seen.add(code);
					}
				const codes = Object.keys(whole[edition]!.data);
				if (complete) expect(seen).toEqual(new Set(codes));
				else expect(codes).toEqual(expect.arrayContaining([...seen]));
			}

			const layout = chunked.find(
				(definition) => definition.precompiledFile === file,
			)?.payload;
			const merged = decodeCompactPayload(
				mergeDatasetPayloads(chunks, layout),
			) as typeof whole;
			for (const edition of Object.keys(whole))
				for (const [code, record] of Object.entries(
					merged[edition]!.data,
				))
					expect(
						isDeepStrictEqual(record, whole[edition]!.data[code]),
					).toBe(true);
		},
	);
});
