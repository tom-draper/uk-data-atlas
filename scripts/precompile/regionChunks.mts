import { join } from "path";
import type { parseBoundaryWardToLad } from "@uk-data-atlas/geography";
import type { GazetteerCore } from "../../lib/data/gazetteer/types";
import { writeDatasetRegionChunks } from "../dataset-region-chunks.mts";
import { elapsedSince, logArtifact } from "../timing.mts";
import {
	fileSnapshots,
	fileSnapshotsOrEmpty,
	sameCompiledOutput,
	sameCompiledOutputs,
	sameFileSnapshots,
	snapshotFileContents,
} from "./cache.mts";
import { chunksSize } from "./output.mts";
import { OUT_DIR, ROOT } from "./paths.mts";
import type {
	CompiledDatasets,
	CompiledOutput,
	FileSnapshot,
	ReuseContext,
} from "./types.mts";

type RegionChunkInputs = {
	/** Compiled output of each regional dataset, by output file. */
	regionalDatasets: Record<string, CompiledOutput>;
	compiledDatasets: CompiledDatasets;
	gazetteerCore: { data: GazetteerCore; compiled: CompiledOutput };
	boundaryMappings: { wardToLad: ReturnType<typeof parseBoundaryWardToLad> };
};

/**
 * Splits the regional datasets into per-region chunk files, or keeps the
 * chunks an earlier run wrote when neither the datasets nor the gazetteer have
 * changed. Returns a snapshot of the chunk files for the manifest.
 */
export async function compileRegionChunks(
	{ canReuse, existingManifest }: ReuseContext,
	{
		regionalDatasets,
		compiledDatasets,
		gazetteerCore,
		boundaryMappings,
	}: RegionChunkInputs,
): Promise<FileSnapshot[]> {
	const chunkDirectory = join(OUT_DIR, "chunks");
	const chunkOutputs = await fileSnapshotsOrEmpty(chunkDirectory);
	const cachedRegionChunks = existingManifest.artifacts?.regionChunks;
	const hasChunkContentHashes =
		cachedRegionChunks?.outputs.every(
			(snapshot) => typeof snapshot.sha256 === "string",
		) ?? false;
	const startedAt = performance.now();
	const canReuseRegionChunks =
		canReuse &&
		cachedRegionChunks &&
		hasChunkContentHashes &&
		sameCompiledOutputs(cachedRegionChunks.datasets, regionalDatasets) &&
		sameCompiledOutput(
			cachedRegionChunks.gazetteerCore,
			gazetteerCore.compiled,
		) &&
		(await sameFileSnapshots(
			cachedRegionChunks.outputs,
			chunkOutputs,
			chunkDirectory,
		));
	if (canReuseRegionChunks) {
		const recorded = chunkOutputs.map((snapshot, index) => ({
			...snapshot,
			sha256: cachedRegionChunks.outputs[index]!.sha256,
		}));
		logArtifact("chunks", "chunks/", [
			"cached",
			chunksSize(recorded),
			elapsedSince(startedAt),
		]);
		return recorded;
	}
	await writeDatasetRegionChunks({
		root: ROOT,
		datasets: compiledDatasets,
		core: gazetteerCore.data,
		boundaryMappings,
	});
	const recorded = await snapshotFileContents(
		await fileSnapshots(chunkDirectory),
		chunkDirectory,
	);
	logArtifact("chunks", "chunks/", [
		"compiled",
		chunksSize(recorded),
		elapsedSince(startedAt),
	]);
	return recorded;
}
