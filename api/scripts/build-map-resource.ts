import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AreaGeometryCache } from "../src/areaGeometry";
import { readGeometrySourceLookup } from "../src/geometrySources";
import {
	compileMapResource,
	type BoundaryReleaseSummary,
	type MapResourceDescriptor,
} from "../src/mapResource/compileMapResource";

/**
 * Compile the boundary releases published as map resources.
 *
 * One release to begin with, the one the correct-map path already pins. A map
 * resource is expensive to build and large to carry, so releases are added
 * here deliberately rather than every release being tiled because it exists.
 */
const PUBLISHED = [{ geography: "localAuthority", id: "2023-05-uk-bgc-v2" }];

export const buildMapResources = (root: string) => {
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
	const cache = new AreaGeometryCache(
		root,
		readGeometrySourceLookup(join(root, "api")),
	);
	mkdirSync(join(out, "map-resources"), { recursive: true });

	const resources: MapResourceDescriptor[] = [];
	for (const wanted of PUBLISHED) {
		const release = registry.releases.find(
			(candidate) =>
				candidate.geography === wanted.geography &&
				candidate.id === wanted.id,
		);
		if (!release)
			throw new Error(
				`No boundary release ${wanted.geography}/${wanted.id} to compile as a map resource.`,
			);
		const identity = inventory.releases.find(
			(candidate) =>
				candidate.geography === wanted.geography &&
				candidate.id === wanted.id &&
				candidate.status === "available",
		);
		if (!identity)
			throw new Error(
				`No area identities for ${wanted.geography}/${wanted.id}, so its tiles would carry no names.`,
			);
		const areas = JSON.parse(
			readFileSync(join(out, identity.artifact), "utf8"),
		) as { areas: Array<{ code: string; name: string }> };
		const artifact = `map-resources/${wanted.geography}-${wanted.id}.pmtiles`;
		const { archive, features, descriptor } = compileMapResource(
			cache,
			release,
			new Map(areas.areas.map((area) => [area.code, area.name])),
			artifact,
		);
		writeFileSync(join(out, artifact), archive);
		for (const feature of features)
			writeFileSync(join(out, feature.artifact), feature.body);
		resources.push(descriptor);
	}

	const withoutHash = { schemaVersion: 1 as const, resources };
	const manifest = {
		...withoutHash,
		contentHash: `sha256:${createHash("sha256")
			.update(JSON.stringify(withoutHash))
			.digest("hex")}`,
	};
	const path = join(out, "map-resources.json");
	writeFileSync(path, JSON.stringify(manifest, null, "\t") + "\n");
	return { path, resources };
};

const path = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === path) {
	const result = buildMapResources(resolve(dirname(path), "../.."));
	for (const resource of result.resources)
		console.log(
			`${resource.id}: ${resource.areaCount} areas, ${resource.arcCount} arcs, ${resource.tiles.tileCount} tiles, ${(resource.tiles.bytes / 1048576).toFixed(1)}MB; features ${resource.features.map((entry) => `${entry.tier} ${(entry.bytes / 1048576).toFixed(1)}MB`).join(", ")}`,
		);
	console.log("Wrote " + result.path);
}
