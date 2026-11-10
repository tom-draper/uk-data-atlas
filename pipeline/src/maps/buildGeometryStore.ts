import { sha256Hex } from "../lib/hash.ts";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	AreaGeometryCache,
	compiledGeometryFile,
} from "@uk-data-atlas/geometry";
import { releaseKey } from "@uk-data-atlas/geography";
import { readGeometrySourceLookup } from "@uk-data-atlas/geometry";
import { geometrySubstitution } from "@uk-data-atlas/geometry";
import { encodeGeometryStore } from "@uk-data-atlas/geometry";
import {
	compileGeometryValidity,
	roundKeepingValidity,
} from "./compileGeometryValidity.ts";
import {
	apiRootOf,
	artifactDirectory,
	formatBytes,
	formatDuration,
} from "@uk-data-atlas/atlas-db";
import { hashFile } from "../fileHashCache.ts";
import { recordOutputHash } from "../storage/outputManifest.ts";
import { readJsonSync } from "../lib/json.ts";

/**
 * Compile every registered boundary release into the geometry store the
 * server reads areas from: WGS84, corrected, with each area's envelope, and
 * read without parsing (see src/geometryStore.ts).
 *
 * A release is kept when neither its registered source nor the code that
 * compiles it has changed; `geometry-store/build-state.json` records the key
 * each file was written under, saved after each one, so a stopped build
 * resumes where it was.
 */

/** The code a compiled release depends on: a change to any rebuilds them all. */
const COMPILER_SOURCES = [
	"pipeline/src/maps/buildGeometryStore.ts",
	"pipeline/src/maps/compileGeometryValidity.ts",
	"packages/geometry/src/areaGeometry.ts",
	"packages/geometry/src/geoJsonProperties.ts",
	"packages/geometry/src/geometryStore.ts",
	"packages/geography/src/geometryValidity.ts",
	"packages/geography/src/geometrySpatialIndex.ts",
	"packages/geometry/src/geometrySubstitution.ts",
	"packages/geometry/src/gridOffset.ts",
	"packages/geography/src/packedGeometry.ts",
	"packages/geography/src/coordinates/reprojection.ts",
	"packages/geography/src/geometryPointContainment.ts",
	"packages/geography/src/geometryPositions.ts",
	"packages/geography/src/geometryTypes.ts",
	"packages/geography/src/areaDistance.ts",
	"packages/geometry/src/borders.ts",
	"packages/geometry/src/spatialQueries.ts",
	"packages/shapefile/src/dbf.ts",
	"packages/geography/src/geometryProvenance.ts",
	"packages/shapefile/src/shapefile.ts",
	"packages/geography/src/geometrySubstitutions.ts",
];

export const buildGeometryStore = (
	root: string,
	log: (line: string) => void = () => {},
) => {
	const sources = readGeometrySourceLookup(root);
	const directory = join(artifactDirectory(root), "geometry-store");
	mkdirSync(directory, { recursive: true });
	const compiler = sha256Hex(
		[
			readFileSync(join(apiRootOf(root), "package.json"), "utf8"),
			...COMPILER_SOURCES.map((path) =>
				readFileSync(join(root, path), "utf8"),
			),
		].join("\0"),
	);
	const statePath = join(directory, "build-state.json");
	const previous: Record<string, string> = existsSync(statePath)
		? readJsonSync(statePath)
		: {};
	const state: Record<string, string> = {};
	const saveState = () =>
		writeFileSync(statePath, JSON.stringify(state, null, "\t") + "\n");
	// Grid offsets are read from data/source/boundaries rather than named by hash in
	// the source entry, so their files are part of every key too.
	const boundaries = join(root, "data/source", "boundaries");
	const offsets = sha256Hex(
		readdirSync(boundaries)
			.filter((name) => name.endsWith(".json"))
			.sort()
			.map(
				(name) =>
					`${name}\0${readFileSync(join(boundaries, name), "utf8")}`,
			)
			.join("\0"),
	);
	const cache = new AreaGeometryCache(
		root,
		sources,
		1,
		undefined,
		undefined,
		roundKeepingValidity,
	);

	const written = new Set<string>();
	let compiled = 0;
	const attributeHash = (input: string | undefined) => {
		if (!input || !/\.shp$/i.test(input)) return undefined;
		const path = join(
			root,
			"data/source",
			input.replace(/\.shp$/i, ".dbf"),
		);
		return existsSync(path) ? hashFile(path) : null;
	};
	for (const [identity, source] of sources) {
		const [geography, boundaryRelease] = identity.split("/") as [
			string,
			string,
		];
		const file = compiledGeometryFile(geography, boundaryRelease);
		written.add(file);
		// A substitution takes areas from another release, whose source is
		// part of this one's.
		const donors = (source.substitutions ?? []).map((id) => {
			const { donor } = geometrySubstitution(id);
			return sources.get(
				releaseKey(donor.geography, donor.boundaryRelease),
			);
		});
		const key = sha256Hex(
			JSON.stringify({
				compiler,
				offsets,
				source,
				donors,
				attributes: attributeHash(source.input),
				donorAttributes: donors.map((donor) =>
					attributeHash(donor?.input),
				),
			}),
		);
		if (previous[identity] === key && existsSync(join(directory, file))) {
			state[identity] = key;
			continue;
		}
		const started = performance.now();
		const body = encodeGeometryStore(
			source,
			cache.compile(geography, boundaryRelease),
			compileGeometryValidity,
		);
		// Written beside and moved into place, so a server reading the store
		// never sees half a file.
		writeFileSync(join(directory, `${file}.partial`), body);
		renameSync(join(directory, `${file}.partial`), join(directory, file));
		// The build need not read the store back to hash it.
		recordOutputHash(join(directory, file), sha256Hex(body));
		state[identity] = key;
		saveState();
		compiled += 1;
		log(
			`${identity}: ${formatBytes(body.length)} in ${formatDuration(performance.now() - started)}`,
		);
	}
	for (const name of readdirSync(directory))
		if (name !== "build-state.json" && !written.has(name))
			rmSync(join(directory, name));
	saveState();
	return { directory, releases: sources.size, compiled };
};
