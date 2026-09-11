import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readAreaAdapters } from "../src/areaAdapters";
import { compileAreas } from "../src/areaInventory";
import { createBoundaryRegistry } from "../scripts/build-boundary-registry";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

test("compiles identities from original Shapefile attribute tables", () => {
	const fullRegistry = createBoundaryRegistry(repositoryRoot);
	const registry = {
		...fullRegistry,
		releases: fullRegistry.releases.filter(
			(release) =>
				(release.geography === "dataZone" &&
					release.id === "2011-12-sc-bfc") ||
				(release.geography === "superOutputArea" &&
					release.id === "2011-ni"),
		),
	};
	const { artifacts } = compileAreas(
		repositoryRoot,
		registry,
		readAreaAdapters(
			resolve(repositoryRoot, "api/config/area-property-adapters.json"),
		),
	);
	const dataZones = artifacts.find(
		(artifact) =>
			artifact.geography === "dataZone" &&
			artifact.boundaryRelease === "2011-12-sc-bfc",
	);
	assert.equal(dataZones?.areas.length, 6976);
	assert.ok(dataZones?.areas.some((area) => area.code === "S01006506"));

	const superOutputAreas = artifacts.find(
		(artifact) =>
			artifact.geography === "superOutputArea" &&
			artifact.boundaryRelease === "2011-ni",
	);
	assert.equal(superOutputAreas?.areas.length, 890);
	assert.ok(superOutputAreas?.areas.some((area) => area.code === "95AA01S1"));
});
