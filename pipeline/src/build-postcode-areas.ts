import { sha256 } from "@uk-data-atlas/artifacts";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	postcodeAreasDirectory,
	readPostcodeAreaComponent,
	storePostcodeAreas,
} from "./postcodes/storePostcodeAreas.ts";
import { readPostcodeCoordinates } from "./postcodes/postcodeCoordinates.ts";
import { existsSync, readFileSync } from "node:fs";

import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	isMainThread,
	parentPort,
	Worker,
	workerData,
} from "node:worker_threads";

import {
	readAreaLookup,
	readSqliteAreaInventory as readAreaInventory,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readBuildBoundaryRegistry } from "./buildBoundaryRegistry.ts";
import { readPublicManifest } from "@uk-data-atlas/atlas-runtime/storage";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
import { AreasResolver } from "@uk-data-atlas/atlas-runtime/areas";
import { postcodeAreaReleases } from "@uk-data-atlas/atlas-runtime/postcodes";
import {
	createAreaGeometryCache,
	readGeometrySourceLookup,
} from "@uk-data-atlas/atlas-runtime/geometry";
import {
	compilePostcodeAreas,
	placementsFromShards,
	placePoints,
	releaseCounts,
	type ReleasePlacements,
} from "./postcodes/postcodeAreaCompiler.ts";
import {
	releaseKey,
	type PostcodeAreaRelease,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
} from "@uk-data-atlas/geography/postcode-area-types";

/**
 * Compile postcode placements into a component: the areas each postcode's centroid lies in,
 * for the releases postcode answers read by default.
 *
 * Each release is placed in a worker thread holding that release's geometry.
 * The `verify-postcode-areas` check stage then compares the stored placements
 * with a live lookup for a sample of postcodes. A release whose postcodes,
 * areas and geometry are unchanged since the last build is read back from its
 * shards instead, unless `--rebuild` is given.
 * `--workers N` sets how many releases are placed at once; each holds a
 * release's geometry, packed, and parses its source file to load it.
 */

type Job = {
	repositoryRoot: string;
	geography: string;
	boundaryRelease: string;
	longitudes: SharedArrayBuffer;
	latitudes: SharedArrayBuffer;
};

type JobResult = {
	codes: string[];
	area: Int32Array;
	distanceCm: Int32Array;
	several: Array<
		[
			number,
			ReleasePlacements["several"] extends Map<number, infer V>
				? V
				: never,
		]
	>;
	seconds: number;
};

/** Place every postcode in one release. */
const placeRelease = (job: Job): JobResult => {
	const started = performance.now();
	const longitudes = new Float64Array(job.longitudes);
	const latitudes = new Float64Array(job.latitudes);
	const cache = createAreaGeometryCache(job.repositoryRoot, 1);
	const { geography, boundaryRelease } = job;
	const placements = placePoints(
		longitudes,
		latitudes,
		cache.codes(geography, boundaryRelease),
		(code) => cache.get(geography, boundaryRelease, code),
	);
	return {
		codes: placements.codes,
		area: placements.area,
		distanceCm: placements.distanceCm,
		several: [...placements.several.entries()],
		seconds: (performance.now() - started) / 1000,
	};
};

if (!isMainThread) {
	parentPort!.postMessage(placeRelease(workerData as Job));
}

const runJob = (job: Job) =>
	new Promise<JobResult>((done, fail) => {
		const worker = new Worker(new URL(import.meta.url), {
			workerData: job,
			resourceLimits: { maxOldGenerationSizeMb: 3072 },
		});
		worker.once("message", done);
		worker.once("error", fail);
		worker.once("exit", (code) => {
			if (code !== 0) fail(new Error(`A worker exited with ${code}.`));
		});
	});

/** The previous build, when it placed these very postcodes. */
const previousBuild = (repositoryRoot: string, postcodeIndex: string) => {
	const manifest = join(
		postcodeAreasDirectory(repositoryRoot),
		"manifest.json",
	);
	if (!existsSync(manifest)) return undefined;
	const artifact: PostcodeAreasArtifact = JSON.parse(
		readFileSync(manifest, "utf8"),
	);
	if (
		artifact.schemaVersion !== 1 ||
		artifact.postcodeIndex !== postcodeIndex
	)
		return undefined;
	return artifact;
};

export const buildPostcodeAreas = async (
	repositoryRoot: string,
	options: { workers?: number; rebuild?: boolean } = {},
) => {
	const { postcodeArtifact, lng, lat, longitudes, latitudes } =
		readPostcodeCoordinates(repositoryRoot);
	const geometrySources = readGeometrySourceLookup(repositoryRoot);
	const { areaInventory, chosen } = (() => {
		const databasePath = join(
			repositoryRoot,
			"data/build/atlas-base.sqlite",
		);
		const areaInventory = readAreaInventory(repositoryRoot, databasePath);
		const resolver = new AreasResolver({
			boundaryRegistry: readBuildBoundaryRegistry(repositoryRoot),
			areaInventory,
			areaLookup: readAreaLookup(
				repositoryRoot,
				areaInventory,
				undefined,
				databasePath,
			),
		});
		const chosen = postcodeAreaReleases(
			resolver,
			readPublicManifest<MeasureCompatibilityInventory>(
				repositoryRoot,
				"measure-compatibility.json",
				"measures",
				"measure compatibility inventory",
			),
			postcodeArtifact.source.edition,
			(geography, boundaryRelease) =>
				geometrySources.get(releaseKey(geography, boundaryRelease))
					?.inputHash !== undefined,
		);
		return { areaInventory, chosen };
	})();
	const inputsOf = (geography: string, boundaryRelease: string) => {
		const release = areaInventory.releases.find(
			(entry) =>
				entry.geography === geography && entry.id === boundaryRelease,
		);
		if (release?.status !== "available")
			throw new Error(`${geography}/${boundaryRelease} has no areas.`);
		return {
			areaRelease: release.contentHash,
			geometryInput: geometrySources.get(
				releaseKey(geography, boundaryRelease),
			)!.inputHash!,
		};
	};

	const count = postcodeArtifact.counts.postcodes;

	const previous = options.rebuild
		? undefined
		: previousBuild(repositoryRoot, postcodeArtifact.contentHash);
	const reusable = new Set(
		(previous?.releases ?? []).flatMap((release) => {
			const current = inputsOf(
				release.geography,
				release.boundaryRelease,
			);
			return current.areaRelease === release.areaRelease &&
				current.geometryInput === release.geometryInput
				? [releaseKey(release.geography, release.boundaryRelease)]
				: [];
		}),
	);
	const placed = new Map<string, ReleasePlacements>();
	const toReuse = chosen.filter((release) =>
		reusable.has(releaseKey(release.geography, release.boundaryRelease)),
	);
	if (previous && toReuse.length > 0) {
		// Read one at a time: the earlier build's shards are hundreds of
		// megabytes of JSON, too much to hold parsed at once.
		const shards = function* () {
			let offset = 0;
			for (const [index, entry] of previous.shards.entries()) {
				const text = readPostcodeAreaComponent(
					repositoryRoot,
					entry.path,
				);
				if (sha256(text) !== entry.contentHash)
					throw new Error(
						`Invalid postcode area shard ${entry.path}`,
					);
				const shard = JSON.parse(text) as PostcodeAreasShard;
				yield { offset, shard };
				offset += postcodeArtifact.shards[index]!.postcodes;
			}
		};
		const reused = placementsFromShards(
			toReuse.map((release) =>
				releaseKey(release.geography, release.boundaryRelease),
			),
			shards(),
			count,
		);
		for (const [key, placements] of reused) {
			placed.set(key, placements);
			buildLog.detail(`Reused ${key}`);
		}
	}

	const queue = chosen.filter(
		(release) =>
			!placed.has(releaseKey(release.geography, release.boundaryRelease)),
	);
	const workers = Math.max(
		1,
		Math.min(
			options.workers ??
				Math.max(1, Math.min(3, availableParallelism() - 1)),
			queue.length,
		),
	);
	await Promise.all(
		Array.from({ length: workers }, async () => {
			for (let next = queue.shift(); next; next = queue.shift()) {
				const key = releaseKey(next.geography, next.boundaryRelease);
				const result = await runJob({
					repositoryRoot,
					geography: next.geography,
					boundaryRelease: next.boundaryRelease,
					longitudes,
					latitudes,
				});
				placed.set(key, {
					codes: result.codes,
					area: result.area,
					distanceCm: result.distanceCm,
					several: new Map(result.several),
				});
				buildLog.detail(
					`Placed ${key} in ${formatDuration(result.seconds * 1000)}`,
				);
			}
		}),
	);

	const releases = chosen.map((release) => {
		const placements = placed.get(
			releaseKey(release.geography, release.boundaryRelease),
		)!;
		const entry: PostcodeAreaRelease = {
			geography: release.geography,
			boundaryRelease: release.boundaryRelease,
			purposes: release.purposes,
			...inputsOf(release.geography, release.boundaryRelease),
			counts: releaseCounts(
				placements,
				(position) => !Number.isNaN(lng[position]!),
			),
		};
		return { release: entry, placements };
	});
	const { artifact, files } = compilePostcodeAreas(
		postcodeArtifact,
		releases,
	);
	const texts = new Map(files.map((file) => [file.path, file.text]));
	const outputPath = storePostcodeAreas(repositoryRoot, artifact, (path) => {
		const text = texts.get(path);
		if (text === undefined)
			throw new Error(`Missing postcode area shard ${path}`);
		return text;
	});
	return { outputPath, artifact };
};

const scriptPath = fileURLToPath(import.meta.url);
if (
	isMainThread &&
	process.argv[1] &&
	resolve(process.argv[1]) === scriptPath
) {
	const workers = process.argv.indexOf("--workers");
	const { outputPath, artifact } = await buildPostcodeAreas(
		resolve(dirname(scriptPath), "../.."),
		{
			rebuild: process.argv.includes("--rebuild"),
			...(workers === -1
				? {}
				: { workers: Number(process.argv[workers + 1]) }),
		},
	);
	buildLog.info(
		`Wrote the areas of every postcode in ${formatCount(artifact.releases.length)} releases, over ${formatCount(artifact.shards.length)} districts, to ${repoPath(outputPath)}`,
	);
}
