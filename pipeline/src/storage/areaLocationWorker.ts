import {
	createAreaGeometryCache,
	readGeometrySources,
} from "@uk-data-atlas/geometry";
import { serveSyncJobs } from "../lib/syncWorkerPool.ts";
import {
	locateArea,
	type AreaLocationJob,
	type AreaLocationResult,
} from "./areaLocations.ts";

/**
 * Finds the places of areas for `writeAreaLocations`. Each worker keeps one
 * release's geometry at a time, as the writer does in its own thread.
 */
let held:
	| {
			sources: ReturnType<typeof readGeometrySources>;
			cache: ReturnType<typeof createAreaGeometryCache>;
	  }
	| undefined;

serveSyncJobs<AreaLocationJob, AreaLocationResult[], { root: string }>(
	({ geography, release, codes }, { root }) => {
		held ??= {
			sources: readGeometrySources(root),
			cache: createAreaGeometryCache(root, 1),
		};
		return codes.map((code) =>
			locateArea(held!.cache, held!.sources, geography, release, code),
		);
	},
);
