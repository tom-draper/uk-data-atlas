import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/loader";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { compileLocationProjections } from "@uk-data-atlas/atlas-runtime/places";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { NamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { createNamedLocationLookup } from "@uk-data-atlas/atlas-runtime/places";
import { readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import {
	readAreaInventory,
	readAreaLookup,
} from "@uk-data-atlas/atlas-runtime/areas";
import { compilePlaceIndex } from "@uk-data-atlas/atlas-runtime/places";
import { namedLocationMembersTable } from "@uk-data-atlas/atlas-runtime/areas";
import { route } from "../services/api/src/routes";
import { testContext } from "../services/api/tests/routeFixtures";
import {
	apiRootOf,
	artifactDirectory,
	roundGeometry,
} from "@uk-data-atlas/atlas-runtime/storage";
import { geometryBounds } from "@uk-data-atlas/geography/geometry-point-containment";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const digest = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");
const before: NamedLocationInventory = JSON.parse(
	readFileSync(join(artifactDirectory(root), "named-locations.json"), "utf8"),
);
const after = readNamedLocationInventory(root);
assert.ok(before.locations.length > 0);
const packed: Omit<NamedLocationInventory, "locations"> & {
	locations: Array<
		NamedLocationInventory["locations"][number] & {
			geometryArtifact?: string;
		}
	>;
} = JSON.parse(
	readFileSync(
		join(artifactDirectory(root), "named-locations-metadata.json"),
		"utf8",
	),
);
assert.equal(packed.contentHash, before.contentHash);
assert.equal(packed.locations.length, before.locations.length);
for (const [
	position,
	{ geometryArtifact, ...location },
] of packed.locations.entries()) {
	const previous = geometryArtifact
		? {
				...location,
				geometry: JSON.parse(
					readFileSync(
						join(apiRoot, "public", geometryArtifact),
						"utf8",
					),
				),
			}
		: location;
	assert.equal(
		digest(previous),
		digest(before.locations[position]),
		location.id,
	);
}

// The database stores each geometry rounded to a metre, with bounds measured
// from the rounded shape. Everything else must match the JSON byte for byte.
const stored: NamedLocationInventory = {
	...before,
	locations: before.locations.map((location) => {
		if (!location.geometry) return location;
		const geometry = roundGeometry(location.geometry.geometry);
		return {
			...location,
			geometry: {
				boundaryRelease: location.geometry.boundaryRelease,
				bbox: geometryBounds(geometry)!,
				geometry,
			},
		};
	}),
};
assert.equal(digest(after), digest(stored));
const areas = readAreaInventory(root);
const areaLookup = readAreaLookup(root, areas);
assert.equal(
	digest(compilePlaceIndex(areaLookup, after, areas.contentHash)),
	digest(compilePlaceIndex(areaLookup, before, areas.contentHash)),
);
assert.equal(
	digest(namedLocationMembersTable(after, "named-locations.json")),
	digest(namedLocationMembersTable(before, "named-locations.json")),
);
const crosswalkInventory = readCrosswalkInventory(root);
const crosswalks = readCrosswalkLookup(root, crosswalkInventory, 0);
let projections = 0;
for (const entry of crosswalkInventory.crosswalks) {
	const inventory = { ...crosswalkInventory, crosswalks: [entry] };
	const artifact = crosswalks.get(entry.id)!;
	const expected = compileLocationProjections(
		before,
		inventory,
		[artifact],
		areaLookup,
	);
	assert.equal(
		digest(
			compileLocationProjections(
				after,
				inventory,
				[artifact],
				areaLookup,
			),
		),
		digest(expected),
		entry.id,
	);
	projections += expected.artifacts.length + expected.parentArtifacts.length;
}
assert.ok(projections > 0);
const contexts = [stored, after].map((inventory) =>
	testContext({
		namedLocationInventory: inventory,
		areaInventory: areas,
		geographyResolver: createGeographyResolver({
			namedLocationInventory: inventory,
			namedLocationLookup: createNamedLocationLookup(inventory),
			areaInventory: areas,
			areaLookup,
		}),
	}),
);
let responses = 0;
const compare = (url: string, status: number) => {
	const expected = route("GET", url, contexts[0]);
	assert.equal(expected.status, status, url);
	assert.equal(digest(route("GET", url, contexts[1])), digest(expected), url);
	responses++;
};
compare("/v1/locations?limit=100", 200);
for (const location of before.locations) {
	compare(`/v1/locations/${location.id}`, 200);
	if (location.geometry)
		compare(`/v1/locations/${location.id}/geometry`, 200);
	const release = areas.releases.find(
		(release) =>
			release.status === "available" &&
			release.geography === location.memberGeography &&
			areaLookup
				.get(`${release.geography}/${release.id}`)
				?.has(location.memberCodes[0] ?? ""),
	);
	if (release)
		compare(
			`/v1/locations/${location.id}/members?release=${release.id}`,
			200,
		);
}
compare("/v1/locations/missing-location", 404);
console.log(
	`Matched ${before.locations.length} named locations, ${before.locations.reduce((total, location) => total + location.memberCodes.length, 0)} members, place-index, membership export and ${projections} projection outputs, and ${responses} API responses byte for byte.`,
);
