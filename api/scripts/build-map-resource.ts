import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AreaGeometryCache } from "../src/areaGeometry";
import { releaseKey } from "../src/geographyKeys";
import { readGeometrySourceLookup } from "../src/geometrySources";
import {
	compileMapResource,
	type BoundaryReleaseSummary,
	type MapResourceDescriptor,
} from "../src/mapResource/compileMapResource";

/**
 * Compile every boundary release into a map resource: its tiles, and each
 * geometry tier as a whole-release download.
 *
 * A release takes from seconds to minutes, so one whose inputs have not changed
 * since it was last compiled is kept rather than rebuilt. Its inputs are the
 * geometry source file, the names the tiles carry, the release's title and
 * attribution, and the compiler's own code; `map-resources/build-state.json`
 * records the hash of all four, and the descriptor, for each release.
 */

/** The code a map resource is compiled by: a change to any of it rebuilds every release. */
const COMPILER_SOURCES = [
	...readdirSync(
		resolve(dirname(fileURLToPath(import.meta.url)), "../src/mapResource"),
	)
		.filter((name) => name.endsWith(".ts"))
		.map((name) => `src/mapResource/${name}`),
	"src/simplifyGeometry.ts",
	"src/parquet.ts",
];

const sha256 = (content: string | Buffer) =>
	createHash("sha256").update(content).digest("hex");

type Unavailable = {
	geography: string;
	boundaryRelease: string;
	reason: string;
};

export const buildMapResources = (
	root: string,
	log: (line: string) => void = () => {},
) => {
	const out = join(root, "api", "public");
	if (!existsSync(out))
		throw new Error(
			"Create the API public directory before building map resources.",
		);
	const registry = JSON.parse(
		readFileSync(join(out, "boundary-releases.json"), "utf8"),
	) as { releases: BoundaryReleaseSummary[] };
	const inventory = JSON.parse(
		readFileSync(join(out, "area-inventory.json"), "utf8"),
	) as {
		releases: Array<{
			geography: string;
			id: string;
			status: string;
			artifact: string;
		}>;
	};
	const geometrySources = readGeometrySourceLookup(join(root, "api"));
	const cache = new AreaGeometryCache(root, geometrySources);
	const directory = join(out, "map-resources");
	mkdirSync(directory, { recursive: true });

	const compiler = sha256(
		COMPILER_SOURCES.map((path) =>
			readFileSync(join(root, "api", path), "utf8"),
		).join("\0"),
	);
	// Each compiled release's key and descriptor, saved as soon as it is
	// written, so a build stopped part way resumes from the last release it
	// finished rather than from nothing.
	const statePath = join(directory, "build-state.json");
	const previous: Record<
		string,
		{ key: string; descriptor: MapResourceDescriptor }
	> = existsSync(statePath)
		? JSON.parse(readFileSync(statePath, "utf8"))
		: {};
	const state = { ...previous };
	const saveState = () =>
		writeFileSync(statePath, JSON.stringify(state) + "\n");
	const manifestPath = join(out, "map-resources.json");

	const resources: MapResourceDescriptor[] = [];
	const unavailable: Unavailable[] = [];
	const compiledIds = new Set<string>();
	for (const identity of inventory.releases) {
		if (identity.status !== "available") continue;
		const { geography, id: boundaryRelease } = identity;
		const release = registry.releases.find(
			(candidate) =>
				candidate.geography === geography &&
				candidate.id === boundaryRelease,
		);
		if (!release)
			throw new Error(
				`No boundary release ${geography}/${boundaryRelease} to compile as a map resource.`,
			);
		const areas = JSON.parse(
			readFileSync(join(out, identity.artifact), "utf8"),
		) as { areas: Array<{ code: string; name: string }> };
		const names = new Map(
			areas.areas.map((area) => [area.code, area.name]),
		);
		const id = releaseKey(geography, boundaryRelease);
		const key = sha256(
			JSON.stringify({
				compiler,
				geometry: cache.provenance(geography, boundaryRelease)
					.inputHash,
				names: [...names].sort(([a], [b]) => a.localeCompare(b)),
				release,
			}),
		);
		const kept = previous[id];
		if (
			kept?.key === key &&
			[kept.descriptor.tiles, ...kept.descriptor.features].every(
				(entry) => existsSync(join(out, entry.artifact)),
			)
		) {
			resources.push(kept.descriptor);
			compiledIds.add(id);
			continue;
		}

		const artifact = `map-resources/${geography}-${boundaryRelease}.pmtiles`;
		const started = performance.now();
		let compiled: ReturnType<typeof compileMapResource>;
		try {
			compiled = compileMapResource(cache, release, names, artifact);
		} catch (error) {
			// A release that is not a coverage cannot be tiled without drawing one
			// area over another. It stays served area by area, and is listed
			// here with the reason, rather than failing every other release.
			const reason = (error as Error).message;
			unavailable.push({ geography, boundaryRelease, reason });
			log(`${id}: not compiled. ${reason}`);
			continue;
		}
		const { archive, features, descriptor } = compiled;
		writeFileSync(join(out, artifact), archive);
		for (const feature of features)
			writeFileSync(join(out, feature.artifact), feature.body);
		resources.push(descriptor);
		compiledIds.add(id);
		state[id] = { key, descriptor };
		saveState();
		log(
			`${descriptor.id}: ${descriptor.areaCount} areas, ${descriptor.tiles.tileCount} tiles, ${(descriptor.tiles.bytes / 1048576).toFixed(1)}MB; features ${descriptor.features.map((entry) => `${entry.tier} ${entry.format} ${((entry.gzipBytes ?? entry.bytes) / 1048576).toFixed(1)}MB`).join(", ")}; ${((performance.now() - started) / 1000).toFixed(1)}s`,
		);
	}

	// Files left by a release that is no longer compiled, or by an artifact
	// name that has changed, would otherwise be carried into every deployment.
	const current = new Set(
		resources.flatMap((resource) => [
			resource.tiles.artifact,
			...resource.features.map((entry) => entry.artifact),
		]),
	);
	for (const name of readdirSync(directory))
		if (
			name !== "build-state.json" &&
			!current.has(`map-resources/${name}`)
		)
			rmSync(join(directory, name));
	for (const id of Object.keys(state))
		if (!compiledIds.has(id)) delete state[id];
	saveState();

	const withoutHash = { schemaVersion: 1 as const, resources, unavailable };
	const manifest = {
		...withoutHash,
		contentHash: `sha256:${createHash("sha256")
			.update(JSON.stringify(withoutHash))
			.digest("hex")}`,
	};
	writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
	return { path: manifestPath, resources, unavailable };
};

const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildMapResources(resolve(dirname(path), "../.."), (line) =>
		console.log(line),
	);
	console.log(
		`Wrote ${result.resources.length} map resources to ${result.path}` +
			(result.unavailable.length
				? `; ${result.unavailable.length} releases could not be compiled`
				: ""),
	);
}
