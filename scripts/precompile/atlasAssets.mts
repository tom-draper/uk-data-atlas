import { readFile } from "fs/promises";
import { join } from "path";
import {
	parseBoundaryWardToLad,
	parseParishLadMappings,
} from "@uk-data-atlas/geography";
import { loadGazetteerCore } from "../../lib/data/gazetteer/loader";
import { loadMatchIndex } from "../../lib/data/gazetteer/matchIndex";
import { elapsedSince, formatKb, logArtifact } from "../timing.mts";
import {
	fileSnapshots,
	outputMatches,
	sameFileSnapshots,
	snapshotFileContents,
} from "./cache.mts";
import { out } from "./output.mts";
import { OUT_DIR, PUBLIC_DATA } from "./paths.mts";
import { readBoundaryAsset } from "./sources/read.mts";
import type { ReuseContext } from "./types.mts";

/**
 * Compiles the gazetteer core and the upload match index from the boundary
 * releases, or reuses them when no boundary file has changed.
 *
 * The returned promises are already running. The caller settles them together
 * with the datasets, so a failure in one is reported alongside the others.
 */
export async function compileAtlasAssets({
	canReuse,
	existingManifest,
}: ReuseContext) {
	const boundaryDirectory = join(PUBLIC_DATA, "boundaries");
	const boundaryInputs = await fileSnapshots(boundaryDirectory);
	// The gazetteer, mappings and upload index all traverse overlapping boundary
	// releases. Share each raw asset for this build; each loader still owns its
	// decoded representation, so their contracts and mutations remain isolated.
	const boundaryReads = new Map<string, Promise<string>>();
	const readBoundaryOnce = (path: string) => {
		let content = boundaryReads.get(path);
		if (!content) {
			content = readBoundaryAsset(path);
			boundaryReads.set(path, content);
		}
		return content;
	};
	const cachedAtlasAssets = existingManifest.artifacts?.atlasAssets;
	const hasBoundaryContentHashes =
		cachedAtlasAssets?.inputs.every(
			(snapshot) => typeof snapshot.sha256 === "string",
		) ?? false;
	const startedAt = performance.now();
	const canReuseAtlasAssets =
		canReuse &&
		cachedAtlasAssets &&
		hasBoundaryContentHashes &&
		(await sameFileSnapshots(
			cachedAtlasAssets.inputs,
			boundaryInputs,
			boundaryDirectory,
		)) &&
		(await outputMatches(
			"gazetteer.core",
			cachedAtlasAssets.outputs.gazetteerCore,
		)) &&
		(await outputMatches(
			"gazetteer.matchindex",
			cachedAtlasAssets.outputs.matchIndex,
		));

	const gazetteerCore = canReuseAtlasAssets
		? Promise.resolve({
				data: JSON.parse(
					await readFile(
						join(OUT_DIR, "gazetteer.core.json"),
						"utf8",
					),
				),
				compiled: cachedAtlasAssets.outputs.gazetteerCore,
			})
		: loadGazetteerCore(readBoundaryOnce).then(async (data) => {
				const compiled = await out("gazetteer.core", data);
				logArtifact("gazetteer", "gazetteer.core.json", [
					"compiled",
					formatKb(compiled.bytes),
					elapsedSince(startedAt),
				]);
				return { data, compiled };
			});
	// Ward and parish containment come from the API's geography resolver,
	// written by `pnpm containment:build` and committed; upload matching reads
	// ward and parish parents from them, so the index is compiled in step.
	// Both files are part of the precompiler fingerprint, so a cached index
	// is only reused while they are unchanged.
	const boundaryMappings = readFile(
		join(OUT_DIR, "boundary-mappings.json"),
		"utf8",
	).then((json) => ({ wardToLad: parseBoundaryWardToLad(JSON.parse(json)) }));
	const parishToLad = readFile(
		join(OUT_DIR, "parish-lad-mappings.json"),
		"utf8",
	).then((json) => parseParishLadMappings(JSON.parse(json)));
	const matchIndex = canReuseAtlasAssets
		? Promise.resolve(cachedAtlasAssets.outputs.matchIndex)
		: Promise.all([boundaryMappings, parishToLad]).then(
				async ([{ wardToLad }, parishParents]) => {
					const compiled = await out(
						"gazetteer.matchindex",
						await loadMatchIndex(
							readBoundaryOnce,
							wardToLad,
							parishParents,
						),
					);
					logArtifact("gazetteer", "gazetteer.matchindex.json", [
						"compiled",
						formatKb(compiled.bytes),
						elapsedSince(startedAt),
					]);
					return compiled;
				},
			);
	if (canReuseAtlasAssets)
		for (const [name, output] of [
			["gazetteer.core.json", cachedAtlasAssets.outputs.gazetteerCore],
			["gazetteer.matchindex.json", cachedAtlasAssets.outputs.matchIndex],
		] as const)
			logArtifact("gazetteer", name, [
				"cached",
				formatKb(output.bytes),
				elapsedSince(startedAt),
			]);
	const recordedBoundaryInputs = canReuseAtlasAssets
		? boundaryInputs.map((snapshot, index) => ({
				...snapshot,
				sha256: cachedAtlasAssets.inputs[index]!.sha256,
			}))
		: await snapshotFileContents(boundaryInputs, boundaryDirectory);

	return {
		gazetteerCore,
		boundaryMappings,
		matchIndex,
		recordedBoundaryInputs,
		/** Drops the shared boundary reads once nothing else will want them. */
		releaseBoundaryReads: () => boundaryReads.clear(),
	};
}
