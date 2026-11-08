import {
	isMainThread,
	parentPort,
	Worker,
	workerData,
} from "node:worker_threads";
import {
	createAreaGeometryCache,
	readGeometrySourceLookup,
} from "@uk-data-atlas/atlas-runtime/geometry";
import type { GeoJsonGeometry } from "@uk-data-atlas/atlas-runtime/geometry";
import {
	containPoint,
	geometryBounds,
	pointInBounds,
	type Coordinate,
} from "@uk-data-atlas/geography/geometry-point-containment";
import { compareCodeUnits } from "@uk-data-atlas/search-index";
import { NONE, SEVERAL } from "@uk-data-atlas/geography/postcode-area-types";
import type { Placement } from "./weigh.ts";

/**
 * Place atoms in one release, in a worker that holds that release's geometry
 * and nothing else, so releases are placed one at a time. An atom on a border
 * of several areas, or in none, is placed nowhere.
 */
type Job = {
	root: string;
	geography: string;
	boundaryRelease: string;
	longitudes: SharedArrayBuffer;
	latitudes: SharedArrayBuffer;
};

type Result = { codes: string[]; area: Int32Array; seconds: number };

const GRID_DEGREES = 0.01;
const BOUNDS_SLACK_DEGREES = 1e-9;
const cellOf = (value: number, origin: number) =>
	Math.floor((value + origin) / GRID_DEGREES);

/**
 * Place points in one release's areas: the area containing each point, which
 * is NONE for a point in no area and SEVERAL for one in more than one. This is
 * the postcode placement's search (each area looks through the points inside
 * its bounds) without its distance to the nearest border, which weights do not
 * need and which dominates its cost.
 */
export const placeAtoms = (
	longitudes: Float64Array,
	latitudes: Float64Array,
	codes: string[],
	geometryOf: (code: string) => GeoJsonGeometry | undefined,
): Placement => {
	const count = longitudes.length;
	const sorted = [...codes].sort(compareCodeUnits);
	const cells = new Map<number, number[]>();
	for (let at = 0; at < count; at += 1) {
		const longitude = longitudes[at]!;
		if (Number.isNaN(longitude)) continue;
		const key =
			cellOf(longitude, 180) * 100_000 + cellOf(latitudes[at]!, 90);
		const members = cells.get(key);
		if (members) members.push(at);
		else cells.set(key, [at]);
	}
	const area = new Int32Array(count).fill(NONE);
	sorted.forEach((code, codeAt) => {
		const geometry = geometryOf(code);
		const bounds = geometry && geometryBounds(geometry);
		if (!geometry || !bounds) return;
		const west = cellOf(bounds[0] - BOUNDS_SLACK_DEGREES, 180);
		const east = cellOf(bounds[2] + BOUNDS_SLACK_DEGREES, 180);
		const south = cellOf(bounds[1] - BOUNDS_SLACK_DEGREES, 90);
		const north = cellOf(bounds[3] + BOUNDS_SLACK_DEGREES, 90);
		for (let x = west; x <= east; x += 1)
			for (let y = south; y <= north; y += 1) {
				const members = cells.get(x * 100_000 + y);
				if (!members) continue;
				for (const at of members) {
					const point: Coordinate = [longitudes[at]!, latitudes[at]!];
					if (!pointInBounds(point, bounds)) continue;
					if (containPoint(point, geometry) === "outside") continue;
					area[at] = area[at] === NONE ? codeAt : SEVERAL;
				}
			}
	});
	return { codes: sorted, area };
};

const place = (job: Job): Result => {
	const started = performance.now();
	const cache = createAreaGeometryCache(job.root, 1);
	const { geography, boundaryRelease } = job;
	const placements = placeAtoms(
		new Float64Array(job.longitudes),
		new Float64Array(job.latitudes),
		cache.codes(geography, boundaryRelease),
		(code) => cache.get(geography, boundaryRelease, code),
	);
	return {
		codes: placements.codes,
		area: placements.area,
		seconds: (performance.now() - started) / 1000,
	};
};

if (!isMainThread && workerData?.kind === "crosswalk-weight-placement")
	parentPort!.postMessage(place(workerData.job as Job));

export const placeInRelease = (job: Job) =>
	new Promise<Result>((done, fail) => {
		const worker = new Worker(new URL(import.meta.url), {
			workerData: { kind: "crosswalk-weight-placement", job },
			resourceLimits: { maxOldGenerationSizeMb: 3072 },
		});
		worker.once("message", done);
		worker.once("error", fail);
		worker.once("exit", (code) => {
			if (code !== 0) fail(new Error(`A worker exited with ${code}.`));
		});
	});

/** The releases that have geometry to place atoms in. */
export const releasesWithGeometry = (root: string) => {
	const sources = readGeometrySourceLookup(root);
	return (geography: string, boundaryRelease: string) =>
		sources.get(`${geography}/${boundaryRelease}`)?.inputHash;
};

export type { Placement };
