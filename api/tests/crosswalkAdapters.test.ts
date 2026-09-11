import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { readCrosswalkAdapters } from "../src/crosswalkAdapters";

const containment = {
	id: "ward-to-lad-clean-containment",
	input: "boundaries/ward/2025/wards.geojson",
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	from: {
		geography: "ward",
		boundaryRelease: "2025",
		codeProperty: "WD25CD",
		nameProperty: "WD25NM",
	},
	to: {
		geography: "localAuthority",
		boundaryRelease: "2025",
		codeProperty: "LAD25CD",
		nameProperty: "LAD25NM",
	},
};

const areaOverlap = {
	id: "constituency-to-lad-area-overlap",
	method: "area-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "area",
		normalisation: "per-source",
	},
	from: { geography: "constituency", boundaryRelease: "2024" },
	to: { geography: "localAuthority", boundaryRelease: "2024" },
	sliverWidthM: 100,
	minimumCoverage: 0.99,
};

const read = (crosswalks: unknown[]) => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const path = join(directory, "crosswalk-adapters.json");
		writeFileSync(path, JSON.stringify({ schemaVersion: 1, crosswalks }));
		return readCrosswalkAdapters(path);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

test("reads property and area-overlap adapters", () => {
	assert.deepEqual(read([containment, areaOverlap]), [
		containment,
		areaOverlap,
	]);
});

test("rejects an adapter whose quality or weighting contradicts its method", () => {
	for (const adapter of [
		{ ...areaOverlap, quality: "publisher-supplied" },
		{ ...areaOverlap, weighting: { status: "not-applicable" } },
		{ ...containment, quality: "derived" },
		{ ...containment, weighting: { status: "provided" } },
	]) {
		assert.throws(() => read([adapter]), /Invalid crosswalk adapter/);
	}
});

test("rejects area-overlap thresholds outside their range", () => {
	for (const adapter of [
		{ ...areaOverlap, sliverWidthM: 0 },
		{ ...areaOverlap, minimumCoverage: 1.5 },
		{ ...areaOverlap, minimumCoverage: undefined },
	]) {
		assert.throws(() => read([adapter]), /Invalid crosswalk adapter/);
	}
});

test("rejects a property adapter without an input or property names", () => {
	const { input: _input, ...withoutInput } = containment;
	for (const adapter of [
		withoutInput,
		{
			...containment,
			from: { geography: "ward", boundaryRelease: "2025" },
		},
	]) {
		assert.throws(() => read([adapter]), /Invalid crosswalk adapter/);
	}
});
