import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { readCrosswalkAdapters } from "@uk-data-atlas/atlas-runtime/relationships";
import { compileCrosswalks } from "./helpers/compileCrosswalks";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { readGeometrySourceLookup } from "@uk-data-atlas/atlas-runtime/geometry";

const adapters = readCrosswalkAdapters(
	new URL("../config/crosswalk-adapters.json", import.meta.url).pathname,
);
const nhsId =
	"nhs-england-region-2022-07-en-bgc-to-nhs-england-region-2024-01-en-bgc-area-overlap";
const niId =
	"data-zone-2021-ni-to-local-authority-2025-12-uk-bgc-official-lookup";

test("configures NHS overlap and NI published membership with distinct claims", () => {
	const nhs = adapters.find(({ id }) => id === nhsId);
	assert.equal(nhs?.method, "area-overlap");
	assert.ok(nhs?.method === "area-overlap");
	assert.equal(nhs.minimumCoverage, 0.99);
	const ni = adapters.find(({ id }) => id === niId);
	assert.ok(ni?.method === "official-lookup");
	assert.equal(ni.relationshipPurpose, "membership");
	assert.equal(ni.to.codeProperty, "LGD2014_cd");
	assert.deepEqual(ni.weighting, { status: "not-provided" });
});

// Opt in against a downloaded archive. Compilation only reads this root.
const repositoryRoot = process.env.CROSSWALK_PROOF_ROOT;
test(
	"compiles NHS recodes and all NI memberships against the held archive",
	{
		skip: !repositoryRoot,
	},
	() => {
		assert.ok(repositoryRoot);
		const apiRoot = join(repositoryRoot, "services/api");
		const { artifacts } = compileCrosswalks(
			repositoryRoot,
			adapters.filter(({ id }) => id === nhsId || id === niId),
			readAreaLookup(apiRoot),
			readGeometrySourceLookup(apiRoot),
		);
		const nhs = artifacts.find(({ id }) => id === nhsId);
		assert.ok(nhs?.method === "area-overlap");
		assert.equal(nhs.records.length, 7);
		assert.ok(
			nhs.records.every(
				({ targets }) =>
					targets.length === 1 && targets[0].weight === 1,
			),
		);
		for (const [from, to] of [
			["E40000007", "E40000013"],
			["E40000010", "E40000014"],
		]) {
			assert.equal(
				nhs.records.find(({ source }) => source.code === from)
					?.targets[0].code,
				to,
			);
		}
		assert.ok(nhs.validation.overlap.minimumSourceCoverage >= 0.99);
		const ni = artifacts.find(({ id }) => id === niId);
		assert.ok(ni?.method === "official-lookup");
		assert.equal(ni.records.length, 3780);
		assert.ok(ni.records.every(({ targets }) => targets.length === 1));
		assert.equal(
			new Set(
				ni.records.flatMap(({ targets }) =>
					targets.map(({ code }) => code),
				),
			).size,
			11,
		);
		assert.equal(ni.validation.geometryContainment, undefined);
		for (const artifact of artifacts) {
			assert.equal(artifact.validation.endpoints.from.status, "verified");
			assert.equal(artifact.validation.endpoints.to.status, "verified");
		}
	},
);
