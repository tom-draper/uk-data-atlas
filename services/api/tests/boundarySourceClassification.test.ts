import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBoundaryRegistry } from "../../../pipeline/src/build-boundary-registry";
import { sha256 } from "@uk-data-atlas/artifacts";
import { selectReleaseForDate } from "@uk-data-atlas/atlas-runtime/areas";
import { createSourceInventory } from "../../../pipeline/src/sourceInventory";

test("keeps the ONS names-and-codes table out of boundary release selection", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-source-classification-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	let namesAndCodesMetadata = "";
	for (const id of ["2011-12-sc-nc", "2011-12-sc-bfc"]) {
		const directory = join(
			root,
			"data/source",
			"boundaries",
			"data-zone",
			id,
		);
		mkdirSync(directory, { recursive: true });
		const raw = JSON.stringify({
			id,
			kind: "boundary",
			title: id,
			publisher: "ONS",
			sourceUrl: "https://geoportal.statistics.gov.uk/",
			licence: { name: "Open Government Licence v3.0" },
			spatialCoverage: { geography: "dataZone", countries: ["GB-SCT"] },
			files: [{ path: "source.geojson", role: "source" }],
		});
		writeFileSync(join(directory, "meta.json"), raw);
		if (id.endsWith("-nc")) namesAndCodesMetadata = raw;
	}
	const registry = createBoundaryRegistry(root);
	assert.deepEqual(
		registry.releases.map(({ id }) => id),
		["2011-12-sc-bfc"],
	);
	const selection = selectReleaseForDate(
		registry,
		"dataZone",
		"2020-01",
		"GB-SCT",
		new Map(),
	);
	assert.equal(selection.status, "selected");
	if (selection.status === "selected")
		assert.equal(selection.selected.id, "2011-12-sc-bfc");
	const source = createSourceInventory(root).sources.find(
		({ key }) => key === "boundaries/data-zone/2011-12-sc-nc",
	);
	assert.ok(source);
	assert.equal(source.kind, "lookup");
	assert.equal(
		source.title,
		"Data Zones (December 2011) Names and Codes in SC",
	);
	assert.equal(source.metadataHash, sha256(namesAndCodesMetadata));
});
