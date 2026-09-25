import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	isMainThread,
	parentPort,
	Worker,
	workerData,
} from "node:worker_threads";
import { distanceToBoundaryM } from "../src/areaDistance";
import {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
	readPostcodeIndex,
} from "../src/boundaryLoader";
import { readMeasureCompatibility } from "../src/catalogueManifestLoader";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	createAreaGeometryCache,
	readGeometrySources,
} from "../src/geometryLoader";
import {
	compilePostcodeAreas,
	NONE,
	placementsFromShards,
	placePoints,
	postcodeAreaReleases,
	releaseCounts,
	releaseKey,
	SEVERAL,
	toCentimetres,
	type PostcodeAreaRelease,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
	type ReleasePlacements,
} from "../src/postcodeAreas";
import {
	parsePostcode,
	postcodeLookupPoint,
	type PostcodeShard,
} from "../src/postcodes";

/**
 * Compile api/public/postcode-areas.json and one shard per postcode district
 * under api/public/postcode-areas: the areas each postcode's centroid lies in,
 * for the releases postcode answers read by default.
 *
 * Each release is placed in a worker thread holding that release's geometry,
 * and checked there against the live lookup for a sample of postcodes; any
 * difference fails the build. A release whose postcodes, areas and geometry
 * are unchanged since the last build is read back from its shards instead,
 * unless `--rebuild` is given.
 * `--workers N` sets how many releases are placed at once; each holds a
 * release's geometry, some hundreds of megabytes.
 */

type Job = {
	apiRoot: string;
	geography: string;
	boundaryRelease: string;
	longitudes: SharedArrayBuffer;
	latitudes: SharedArrayBuffer;
	verifyEvery: number;
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
	verified: number;
	seconds: number;
};

/** Place every postcode in one release, then check a sample the live way. */
const placeRelease = (job: Job): JobResult => {
	const started = performance.now();
	const longitudes = new Float64Array(job.longitudes);
	const latitudes = new Float64Array(job.latitudes);
	const cache = createAreaGeometryCache(job.apiRoot, 1);
	const { geography, boundaryRelease } = job;
	const placements = placePoints(
		longitudes,
		latitudes,
		cache.codes(geography, boundaryRelease),
		(code) => cache.get(geography, boundaryRelease, code),
	);
	const expected = (at: number) => {
		const area = placements.area[at]!;
		if (area === NONE) return [];
		if (area === SEVERAL)
			return placements.several
				.get(at)!
				.map(([codeAt, containment, distance]) => [
					placements.codes[codeAt]!,
					containment,
					distance,
				]);
		return [
			[placements.codes[area]!, "interior", placements.distanceCm[at]!],
		];
	};
	let verified = 0;
	const check = (at: number) => {
		const point: [number, number] = [longitudes[at]!, latitudes[at]!];
		const live = cache
			.findContaining(geography, boundaryRelease, point)
			.map(({ code, containment }) => [
				code,
				containment,
				toCentimetres(
					distanceToBoundaryM(
						point,
						cache.get(geography, boundaryRelease, code)!,
					),
				),
			]);
		const compiled = expected(at);
		if (JSON.stringify(live) !== JSON.stringify(compiled))
			throw new Error(
				`${releaseKey(geography, boundaryRelease)}: point ${at} at ${point.join(",")} is placed in ${JSON.stringify(compiled)}, but a live lookup finds ${JSON.stringify(live)}.`,
			);
		verified += 1;
	};
	for (let at = 0; at < longitudes.length; at += job.verifyEvery)
		if (!Number.isNaN(longitudes[at]!)) check(at);
	for (const at of placements.several.keys()) check(at);
	return {
		codes: placements.codes,
		area: placements.area,
		distanceCm: placements.distanceCm,
		several: [...placements.several.entries()],
		verified,
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
const previousBuild = (publicRoot: string, postcodeIndex: string) => {
	const path = join(publicRoot, "postcode-areas.json");
	if (!existsSync(path)) return undefined;
	const artifact = JSON.parse(
		readFileSync(path, "utf8"),
	) as PostcodeAreasArtifact;
	if (
		artifact.schemaVersion !== 1 ||
		artifact.postcodeIndex !== postcodeIndex
	)
		return undefined;
	return artifact;
};

export const buildPostcodeAreas = async (
	repositoryRoot: string,
	options: { workers?: number; verifyEvery?: number; rebuild?: boolean } = {},
) => {
	const apiRoot = join(repositoryRoot, "api");
	const publicRoot = join(apiRoot, "public");
	const postcodeIndex = readPostcodeIndex(apiRoot);
	const areaInventory = readAreaInventory(apiRoot);
	const geometrySources = readGeometrySources(apiRoot);
	const resolver = createGeographyResolver({
		boundaryRegistry: readBoundaryRegistry(apiRoot),
		areaInventory,
		areaLookup: readAreaLookup(apiRoot, areaInventory),
	});
	const chosen = postcodeAreaReleases(
		resolver,
		readMeasureCompatibility(apiRoot),
		postcodeIndex.artifact.source.edition,
		(geography, boundaryRelease) =>
			geometrySources.get(releaseKey(geography, boundaryRelease))
				?.inputHash !== undefined,
	);
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

	// Every centroid, in the postcode index's shard order.
	const count = postcodeIndex.artifact.counts.postcodes;
	const longitudes = new SharedArrayBuffer(count * 8);
	const latitudes = new SharedArrayBuffer(count * 8);
	const lng = new Float64Array(longitudes).fill(Number.NaN);
	const lat = new Float64Array(latitudes).fill(Number.NaN);
	let at = 0;
	for (const entry of postcodeIndex.artifact.shards) {
		const shard = JSON.parse(
			readFileSync(join(publicRoot, entry.path), "utf8"),
		) as PostcodeShard;
		for (const postcode of shard.postcodes) {
			const found = postcodeIndex.lookup(
				parsePostcode(postcode) as Extract<
					ReturnType<typeof parsePostcode>,
					{ kind: "unit" }
				>,
			);
			if (found.status === "found" && found.record.centroid) {
				const point = postcodeLookupPoint(found.record.centroid);
				lng[at] = point.lng;
				lat[at] = point.lat;
			}
			at += 1;
		}
	}
	if (at !== count)
		throw new Error(
			`The postcode index counts ${count} postcodes but holds ${at}.`,
		);

	const previous = options.rebuild
		? undefined
		: previousBuild(publicRoot, postcodeIndex.artifact.contentHash);
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
		let offset = 0;
		const shards = previous.shards.map((entry, index) => {
			const shard = JSON.parse(
				readFileSync(join(publicRoot, entry.path), "utf8"),
			) as PostcodeAreasShard;
			const located = { offset, shard };
			offset += postcodeIndex.artifact.shards[index]!.postcodes;
			return located;
		});
		for (const release of toReuse) {
			const key = releaseKey(release.geography, release.boundaryRelease);
			placed.set(key, placementsFromShards(key, shards, count));
			console.log(`Reused ${key}`);
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
					apiRoot,
					geography: next.geography,
					boundaryRelease: next.boundaryRelease,
					longitudes,
					latitudes,
					verifyEvery: options.verifyEvery ?? 5_000,
				});
				placed.set(key, {
					codes: result.codes,
					area: result.area,
					distanceCm: result.distanceCm,
					several: new Map(result.several),
				});
				console.log(
					`Placed ${key} in ${result.seconds.toFixed(0)}s, matching a live lookup for ${result.verified} postcodes`,
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
		postcodeIndex.artifact,
		releases,
	);
	rmSync(join(publicRoot, "postcode-areas"), {
		recursive: true,
		force: true,
	});
	for (const file of files) {
		mkdirSync(dirname(join(publicRoot, file.path)), { recursive: true });
		writeFileSync(join(publicRoot, file.path), file.text);
	}
	const outputPath = join(publicRoot, "postcode-areas.json");
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
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
	console.log(
		`Wrote the areas of every postcode in ${artifact.releases.length} releases, over ${artifact.shards.length} districts, to ${outputPath}`,
	);
}
