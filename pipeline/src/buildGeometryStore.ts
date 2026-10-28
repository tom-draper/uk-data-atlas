import { createHash } from "node:crypto";
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
} from "../../shared/areaGeometry";
import { releaseKey } from "@uk-data-atlas/geography";
import { readGeometrySourceLookup } from "../../shared/geometrySources";
import { geometrySubstitution } from "../../shared/geometrySubstitution";
import { encodeGeometryStore } from "../../shared/geometryStore";
import {
	compileGeometryValidity,
	roundKeepingValidity,
} from "./compileGeometryValidity";
import { apiRootOf, artifactRoot } from "../../shared/dataLayout";

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
	"package.json",
	"../../pipeline/src/buildGeometryStore.ts",
	"../../pipeline/src/compileGeometryValidity.ts",
	"../../shared/areaGeometry.ts",
	"../../shared/geoJsonProperties.ts",
	"../../shared/geometryStore.ts",
	"../../packages/geography/src/geometryValidity.ts",
	"../../shared/geometrySpatialIndex.ts",
	"../../shared/geometrySubstitution.ts",
	"../../shared/gridOffset.ts",
	"../../shared/packedGeometry.ts",
	"../../shared/reprojection.ts",
	"../../shared/areaContainment.ts",
	"../../packages/geography/src/geometryPositions.ts",
	"../../shared/geometryTypes.ts",
	"../../shared/areaDistance.ts",
	"../../shared/areaNeighbours.ts",
	"../../shared/dbf.ts",
	"../../packages/geography/src/geometryProvenance.ts",
	"../../shared/shapefile.ts",
	"../../packages/geography/src/geometrySubstitutions.ts",
];

const sha256 = (content: string | Buffer) =>
	createHash("sha256").update(content).digest("hex");

export const buildGeometryStore = (
	root: string,
	log: (line: string) => void = () => {},
) => {
	const apiRoot = apiRootOf(root);
	const sources = readGeometrySourceLookup(apiRoot);
	const directory = join(artifactRoot(apiRoot), "geometry-store");
	mkdirSync(directory, { recursive: true });
	const compiler = sha256(
		COMPILER_SOURCES.map((path) =>
			readFileSync(join(apiRoot, path), "utf8"),
		).join("\0"),
	);
	const statePath = join(directory, "build-state.json");
	const previous: Record<string, string> = existsSync(statePath)
		? JSON.parse(readFileSync(statePath, "utf8"))
		: {};
	const state: Record<string, string> = {};
	const saveState = () =>
		writeFileSync(statePath, JSON.stringify(state, null, "\t") + "\n");
	// Grid offsets are read from data/source/boundaries rather than named by hash in
	// the source entry, so their files are part of every key too.
	const boundaries = join(root, "data/source", "boundaries");
	const offsets = sha256(
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
		const key = sha256(
			JSON.stringify({ compiler, offsets, source, donors }),
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
		state[identity] = key;
		saveState();
		compiled += 1;
		log(
			`${identity}: ${(body.length / 1048576).toFixed(1)}MB in ${((performance.now() - started) / 1000).toFixed(1)}s`,
		);
	}
	for (const name of readdirSync(directory))
		if (name !== "build-state.json" && !written.has(name))
			rmSync(join(directory, name));
	saveState();
	return { directory, releases: sources.size, compiled };
};
