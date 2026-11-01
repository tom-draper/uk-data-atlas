/** Local-only byte comparison against a pre-change map-resource archive. */
import assert from "node:assert/strict";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles/mapResources";
import {
	AreaGeometryCache,
	readGeometrySourceLookup,
} from "@uk-data-atlas/atlas-runtime/geometry";
import { buildSimplifiedDownload } from "../../packages/atlas-runtime/src/maps/mapResource/simplifiedDownload";

const root = resolve(process.argv[2] ?? ".");
const id = process.argv[3];
assert.ok(
	id,
	"Usage: tsx pipeline/src/verify-map-downloads.ts <baseline-repository> <geography/release>",
);
const state: Record<string, { descriptor?: MapResourceDescriptor }> =
	JSON.parse(
		readFileSync(
			join(root, "data/build/map-resources/build-state.json"),
			"utf8",
		),
	);
const descriptor = state[id]?.descriptor;
assert.ok(descriptor, `No stored baseline descriptor for ${id}`);
const inventory: {
	releases: Array<{ geography: string; id: string; artifact: string }>;
} = JSON.parse(
	readFileSync(
		join(root, "data/build/artifacts/area-inventory.json"),
		"utf8",
	),
);
const identity = inventory.releases.find(
	(entry) => `${entry.geography}/${entry.id}` === id,
);
assert.ok(identity, `No area inventory for ${id}`);
const areas: { areas: Array<{ code: string; name: string }> } = JSON.parse(
	readFileSync(join(root, "data/build/artifacts", identity.artifact), "utf8"),
);
const names = new Map(areas.areas.map((area) => [area.code, area.name]));
// Use the deployed geometry store, as the server does, rather than source geometry.
const cache = new AreaGeometryCache(
	root,
	readGeometrySourceLookup(apiRootOf(root)),
	1,
	join(root, "data/build/artifacts/geometry-store"),
);
let compared = 0;
for (const entry of descriptor.features) {
	if (entry.tier === "full") continue;
	assert.ok(
		entry.artifact,
		`No prebuilt baseline for ${entry.tier}/${entry.format}`,
	);
	const started = performance.now();
	const body = buildSimplifiedDownload(
		cache,
		{
			geography: descriptor.geography,
			boundaryRelease: descriptor.boundaryRelease,
			topology: "shared-arc",
			attribution: descriptor.attribution.text,
		},
		names,
		{
			tier: entry.tier,
			format: entry.format === "geojson" ? "geojson" : "geoparquet",
		},
	);
	assert.ok(body, `No generated download for ${entry.artifact}`);
	const stored = readFileSync(join(root, "data/build", entry.artifact));
	const previous = entry.format === "geojson" ? gunzipSync(stored) : stored;
	assert.ok(previous.equals(body), `Bytes differ: ${entry.artifact}`);
	if (entry.format === "geojson")
		assert.ok(
			stored.equals(gzipSync(body)),
			`Gzip bytes differ: ${entry.artifact}`,
		);
	assert.equal(body.length, entry.bytes);
	assert.equal(sha256(body), entry.contentHash);
	console.log(
		JSON.stringify({
			artifact: entry.artifact,
			bytes: body.length,
			sha256: sha256(body),
			seconds: (performance.now() - started) / 1000,
		}),
	);
	compared++;
}
assert.equal(
	compared,
	5,
	"Expected all five simplified variants to be compared",
);
