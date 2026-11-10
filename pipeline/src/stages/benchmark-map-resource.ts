import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { buildArtifactPath } from "@uk-data-atlas/areas";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { AreaGeometryCache } from "@uk-data-atlas/geometry";
import { readGeometrySourceLookup } from "@uk-data-atlas/geometry";
import {
	compileMapResource,
	type BoundaryReleaseSummary,
} from "../maps/compileMapResource.ts";
import { readJsonSync } from "../lib/json.ts";

// Run from the repository root. Each process compiles one real release without
// consulting the map-resource build cache or overwriting published artifacts.
const root = resolve(process.argv[2] ?? ".");
const id = process.argv[3] ?? "country/2025-12-uk-bgc";
const out = artifactDirectory(root);
const registry: { releases: BoundaryReleaseSummary[] } = readJsonSync(
	buildArtifactPath(root, "boundary-releases.json"),
);
const release = registry.releases.find(
	(entry) => `${entry.geography}/${entry.id}` === id,
);
assert.ok(release, `Unknown release ${id}`);
const inventory: {
	releases: Array<{ geography: string; id: string; artifact: string }>;
} = readJsonSync(join(out, "area-inventory.json"));
const identity = inventory.releases.find(
	(entry) => `${entry.geography}/${entry.id}` === id,
);
assert.ok(identity, `No area inventory for ${id}`);
const areas: { areas: Array<{ code: string; name: string }> } = readJsonSync(
	join(out, identity.artifact),
);
const names = new Map(areas.areas.map((area) => [area.code, area.name]));
const cache = new AreaGeometryCache(root, readGeometrySourceLookup(root));
const cpuStarted = process.cpuUsage();
const started = performance.now();
const result = compileMapResource(
	cache,
	release,
	names,
	`map-resources/${release.geography}-${release.id}.pmtiles`,
);
const elapsedMs = performance.now() - started;
const cpu = process.cpuUsage(cpuStarted);
assert.ok(result.descriptor.areaCount > 0);
assert.ok(result.descriptor.tiles.tileCount > 0);
assert.ok(result.descriptor.features.every((entry) => !entry.artifact));
const hash = createHash("sha256");
hash.update(JSON.stringify(result.descriptor));
hash.update(result.archive);
console.log(
	JSON.stringify({
		id,
		elapsedMs,
		cpuMs: (cpu.user + cpu.system) / 1000,
		areas: result.descriptor.areaCount,
		tiles: result.descriptor.tiles.tileCount,
		bytes: result.archive.length,
		sha256: hash.digest("hex"),
	}),
);
