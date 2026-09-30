import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readApiCatalogues } from "../../src/catalogueLoader";
import { BOUNDARY_CATALOG } from "../../../lib/data/boundaries/catalog";
import { parsePrecompiledBoundaryMappings } from "../../../lib/data/boundaries/mappings";
import {
	compileAreaContainment,
	type ContainmentCrosswalk,
} from "../../../scripts/area-containment";

const apiRoot = new URL("../..", import.meta.url).pathname;
const mappingsPath = new URL(
	"../../../public/data/datasets/boundary-mappings.json",
	import.meta.url,
).pathname;

test("the atlas's committed ward containment is the resolver's", () => {
	const { geographyResolver } = readApiCatalogues(apiRoot);
	const wardReleases = Object.entries(BOUNDARY_CATALOG.ward.vintages).map(
		([year, asset]) => ({
			year: Number(year),
			release: asset.split("/").at(-2)!,
		}),
	);
	const served = new Set(wardReleases.map(({ release }) => release));
	const crosswalks = geographyResolver
		.crosswalkSummaries()
		.filter(
			(summary) =>
				summary.from.geography === "ward" &&
				served.has(summary.from.boundaryRelease),
		)
		.map((summary) => geographyResolver.crosswalk(summary.id))
		.filter(
			(
				artifact,
			): artifact is ContainmentCrosswalk &
				NonNullable<typeof artifact> => artifact !== undefined,
		);
	const committed = parsePrecompiledBoundaryMappings(
		JSON.parse(readFileSync(mappingsPath, "utf8")),
	);
	const expected = compileAreaContainment(wardReleases, crosswalks);
	const differing = Object.keys(expected.wardToLad).filter(
		(ward) => committed.wardToLad[ward] !== expected.wardToLad[ward],
	);
	assert.deepEqual(
		differing.slice(0, 10),
		[],
		`${differing.length} wards are placed in another local authority; run the area containment build again`,
	);
	assert.deepEqual(
		committed,
		expected,
		"The committed containment differs from the resolver's; run the area containment build again",
	);
});
