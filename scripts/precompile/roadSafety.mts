import { join } from "path";
import { Gazetteer } from "../../lib/data/gazetteer/gazetteer";
import type { GazetteerCore } from "../../lib/data/gazetteer/types";
import { loadRoadSafety } from "../../lib/data/road-safety/loader";
import { elapsedSince, formatKb, logArtifact } from "../timing.mts";
import {
	fileStamp,
	isReleasedSource,
	outputMatches,
	sameFileStamp,
} from "./cache.mts";
import { out } from "./output.mts";
import { SOURCE_DATA } from "./paths.mts";
import { readSource } from "./sources/read.mts";
import type { CompiledOutput, ReuseContext } from "./types.mts";

const logRoadSafety = (
	status: "cached" | "compiled",
	outputs: { dataset: CompiledOutput; points: CompiledOutput },
	startedAt: number,
) => {
	for (const [name, output] of [
		["road-safety.json", outputs.dataset],
		["road-safety-points.json", outputs.points],
	] as const)
		logArtifact("dataset", name, [
			status,
			formatKb(output.bytes),
			elapsedSince(startedAt),
		]);
};

/**
 * Compiles road safety, or reuses it. The collisions are written apart from
 * the dataset that describes them, so the card can be drawn from the small
 * file and the 6 MB of points is only fetched once someone selects the
 * dataset. Counting them per location needs the gazetteer's bounding boxes, so
 * this waits on the gazetteer core.
 */
export function compileRoadSafety(
	{ canReuse, existingManifest, sourceRelease }: ReuseContext,
	gazetteerCore: Promise<{ data: GazetteerCore; compiled: CompiledOutput }>,
) {
	const startedAt = performance.now();
	return gazetteerCore.then(async ({ data: core, compiled: coreOutput }) => {
		const path = join(
			SOURCE_DATA,
			"transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv",
		);
		const input = await fileStamp(path);
		const cached = existingManifest.artifacts?.roadSafety;
		if (
			canReuse &&
			cached &&
			(sameFileStamp(cached.input, input) ||
				isReleasedSource(sourceRelease, path, input)) &&
			cached.gazetteerCore.sha256 === coreOutput.sha256 &&
			cached.gazetteerCore.bytes === coreOutput.bytes &&
			(await outputMatches("road-safety", cached.outputs.dataset)) &&
			(await outputMatches("road-safety-points", cached.outputs.points))
		) {
			logRoadSafety("cached", cached.outputs, startedAt);
			return cached;
		}

		const { datasets, points } = await loadRoadSafety(
			readSource,
			new Gazetteer(core),
		);
		const outputs = {
			dataset: await out("road-safety", datasets),
			points: await out("road-safety-points", points),
		};
		logRoadSafety("compiled", outputs, startedAt);
		return { input, gazetteerCore: coreOutput, outputs };
	});
}
