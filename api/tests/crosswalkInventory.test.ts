import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { compileCrosswalks } from "../src/crosswalkInventory";

test("compiles a published lookup without inventing apportionment weights", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const input = "boundaries/constituency/2024/lookup.geojson";
	const path = join(root, "data", input);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(
		path,
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						OLDCD: "E14000001",
						OLDNM: "Old seat",
						NEWCD: "E14001001",
						NEWNM: "New seat A",
					},
				},
				{
					properties: {
						OLDCD: "E14000001",
						OLDNM: "Old seat",
						NEWCD: "E14001002",
						NEWNM: "New seat B",
					},
				},
			],
		}),
	);

	try {
		const areaLookup = createAreaLookup([
			{
				schemaVersion: 1,
				contentHash: "sha256:old",
				geography: "constituency",
				boundaryRelease: "2010",
				codeProperty: "OLDCD",
				nameProperty: "OLDNM",
				areas: [{ code: "E14000001", name: "Old seat" }],
			},
			{
				schemaVersion: 1,
				contentHash: "sha256:new",
				geography: "constituency",
				boundaryRelease: "2024",
				codeProperty: "NEWCD",
				nameProperty: "NEWNM",
				areas: [
					{ code: "E14001001", name: "New seat A" },
					{ code: "E14001002", name: "New seat B" },
				],
			},
		]);
		const { artifacts, inventory } = compileCrosswalks(
			root,
			[
				{
					id: "constituency-2010-to-2024",
					input,
					method: "official-lookup",
					quality: "publisher-supplied",
					weighting: { status: "not-provided" },
					from: {
						geography: "constituency",
						boundaryRelease: "2010",
						codeProperty: "OLDCD",
						nameProperty: "OLDNM",
					},
					to: {
						geography: "constituency",
						boundaryRelease: "2024",
						codeProperty: "NEWCD",
						nameProperty: "NEWNM",
					},
				},
			],
			areaLookup,
		);
		assert.deepEqual(artifacts[0].weighting, { status: "not-provided" });
		assert.deepEqual(artifacts[0].records, [
			{
				source: { code: "E14000001", labels: ["Old seat"] },
				targets: [
					{ code: "E14001001", labels: ["New seat A"] },
					{ code: "E14001002", labels: ["New seat B"] },
				],
			},
		]);
		assert.deepEqual(artifacts[0].validation.sourceNameConflicts, []);
		assert.deepEqual(artifacts[0].validation.endpoints, {
			from: {
				status: "verified",
				availableAreaCount: 1,
				referencedCodeCount: 1,
			},
			to: {
				status: "verified",
				availableAreaCount: 2,
				referencedCodeCount: 2,
			},
		});
		assert.equal(inventory.crosswalks[0].recordCount, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("compiles a published parent-code containment with weighting marked not-applicable", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const input = "boundaries/ward/2025/wards.geojson";
	const path = join(root, "data", input);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(
		path,
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						WD25CD: "E05000932",
						WD25NM: "Ainsdale",
						LAD25CD: "E08000014",
						LAD25NM: "Sefton",
					},
				},
				{
					properties: {
						WD25CD: "E05000933",
						WD25NM: "Birkdale",
						LAD25CD: "E08000014",
						LAD25NM: "Sefton",
					},
				},
			],
		}),
	);

	try {
		const { artifacts, inventory } = compileCrosswalks(root, [
			{
				id: "ward-to-local-authority-2025-05-uk-bgc-v2",
				input,
				method: "clean-containment",
				quality: "publisher-supplied",
				weighting: { status: "not-applicable" },
				from: {
					geography: "ward",
					boundaryRelease: "2025-05-uk-bgc-v2",
					codeProperty: "WD25CD",
					nameProperty: "WD25NM",
				},
				to: {
					geography: "localAuthority",
					boundaryRelease: "2025-05-uk-bgc-v2",
					codeProperty: "LAD25CD",
					nameProperty: "LAD25NM",
				},
			},
		]);
		assert.equal(artifacts[0].method, "clean-containment");
		assert.deepEqual(artifacts[0].weighting, { status: "not-applicable" });
		assert.deepEqual(artifacts[0].records, [
			{
				source: { code: "E05000932", labels: ["Ainsdale"] },
				targets: [{ code: "E08000014", labels: ["Sefton"] }],
			},
			{
				source: { code: "E05000933", labels: ["Birkdale"] },
				targets: [{ code: "E08000014", labels: ["Sefton"] }],
			},
		]);
		assert.equal(inventory.crosswalks[0].method, "clean-containment");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("checks every child geometry vertex against its published parent", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const write = (path: string, value: unknown) => {
		const fullPath = join(root, "data", path);
		mkdirSync(join(fullPath, ".."), { recursive: true });
		writeFileSync(fullPath, JSON.stringify(value));
	};
	write("lookups/ward-to-lad.geojson", {
		type: "FeatureCollection",
		features: [
			{
				properties: {
					WDCD: "W1",
					WDNM: "Child ward",
					LADCD: "L1",
					LADNM: "Parent authority",
				},
			},
		],
	});
	write("boundaries/ward.geojson", {
		type: "FeatureCollection",
		features: [
			{
				properties: { WDCD: "W1" },
				geometry: {
					type: "Polygon",
					coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
				},
			},
		],
	});
	write("boundaries/local-authority.geojson", {
		type: "FeatureCollection",
		features: [
			{
				properties: { LADCD: "L1" },
				geometry: {
					type: "Polygon",
					coordinates: [[[-1, -1], [-1, 2], [2, 2], [-1, -1]]],
				},
			},
		],
	});
	try {
		const { artifacts } = compileCrosswalks(
			root,
			[
				{
					id: "ward-to-local-authority",
					input: "lookups/ward-to-lad.geojson",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
					from: {
						geography: "ward",
						boundaryRelease: "2025",
						codeProperty: "WDCD",
						nameProperty: "WDNM",
					},
					to: {
						geography: "localAuthority",
						boundaryRelease: "2025",
						codeProperty: "LADCD",
						nameProperty: "LADNM",
					},
				},
			],
			undefined,
			new Map([
				[
					"ward/2025",
					{
						input: "boundaries/ward.geojson",
						crs: "EPSG:4326",
						codeProperty: "WDCD",
					},
				],
				[
					"localAuthority/2025",
					{
						input: "boundaries/local-authority.geojson",
						crs: "EPSG:4326",
						codeProperty: "LADCD",
					},
				],
			]),
		);
		assert.deepEqual(artifacts[0].validation.geometryContainment, {
			status: "verified",
			sourceAreaCount: 1,
			testedVertexCount: 4,
			boundaryVertexCount: 3,
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("keeps the publisher's change indicator on each pair, checked against the lookup", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const input = "lookups/lsoa-changes/fixture.geojson";
	const write = (rows: Array<[string, string, string]>) => {
		const path = join(root, "data", input);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(
			path,
			JSON.stringify({
				type: "FeatureCollection",
				features: rows.map(([from, to, change]) => ({
					properties: { OLDCD: from, OLDNM: from, NEWCD: to, NEWNM: to, CHGIND: change },
				})),
			}),
		);
	};
	const compile = () =>
		compileCrosswalks(root, [
			{
				id: "lsoa-changes-fixture",
				input,
				method: "official-lookup",
				quality: "publisher-supplied",
				weighting: { status: "not-provided" },
				changeProperty: "CHGIND",
				from: {
					geography: "lsoa",
					boundaryRelease: "2011",
					codeProperty: "OLDCD",
					nameProperty: "OLDNM",
				},
				to: {
					geography: "lsoa",
					boundaryRelease: "2021",
					codeProperty: "NEWCD",
					nameProperty: "NEWNM",
				},
			},
		]).artifacts[0]!;

	try {
		// A kept whole, B split into two, C and D merged into one.
		write([
			["A", "A2", "U"],
			["B", "B2", "S"],
			["B", "B3", "S"],
			["C", "CD", "M"],
			["D", "CD", "M"],
		]);
		const artifact = compile();
		assert.deepEqual(
			artifact.records.map(({ source, targets }) => [
				source.code,
				targets.map((target) => [target.code, "change" in target ? target.change : undefined]),
			]),
			[
				["A", [["A2", "unchanged"]]],
				["B", [["B2", "split"], ["B3", "split"]]],
				["C", [["CD", "merged"]]],
				["D", [["CD", "merged"]]],
			],
		);
		assert.deepEqual(
			"changes" in artifact.validation ? artifact.validation.changes : undefined,
			{ unchanged: 1, split: 2, merged: 2, complex: 0 },
		);

		// A pair called unchanged that is really one of a split is refused.
		write([
			["B", "B2", "U"],
			["B", "B3", "S"],
		]);
		assert.throws(compile, /change indicators disagree with the lookup: B\|B2 is unchanged/);
		write([["A", "A2", "Q"]]);
		assert.throws(compile, /change indicator Q, not U, S, M or X/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
