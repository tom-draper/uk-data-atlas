import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileRelationshipCandidates } from "../src/relationshipCandidates";
import type { AreaReleaseArtifact } from "../src/areaInventory";

const writeSource = (
	root: string,
	geography: string,
	boundaryRelease: string,
	filename: string,
	features: Array<Record<string, unknown>>,
) => {
	const directory = join(root, "data", "boundaries", geography, boundaryRelease);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, filename),
		JSON.stringify({
			type: "FeatureCollection",
			features: features.map((properties) => ({ properties })),
		}),
	);
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({ files: [{ path: filename, role: "source" }] }),
	);
};

const writeWardSource = (root: string, features: Array<Record<string, unknown>>) =>
	writeSource(root, "ward", "2025", "wards.geojson", features);

// Every artifact scanned needs a real source directory, even one only used
// as a match target: give it a LAD-only file so its own scan finds no extra
// candidate property pairs beyond its own identity.
const writeLadSource = (root: string, areas: Array<{ code: string; name: string }>) =>
	writeSource(
		root,
		"local-authority",
		"2025",
		"lads.geojson",
		areas.map((area) => ({ LAD25CD: area.code, LAD25NM: area.name })),
	);

const wardArtifact = (areas: Array<{ code: string; name: string }>): AreaReleaseArtifact => ({
	schemaVersion: 1,
	contentHash: "sha256:ward-areas",
	geography: "ward",
	boundaryRelease: "2025",
	codeProperty: "WD25CD",
	nameProperty: "WD25NM",
	areas,
});

const ladArtifact = (areas: Array<{ code: string; name: string }>): AreaReleaseArtifact => ({
	schemaVersion: 1,
	contentHash: "sha256:lad-areas",
	geography: "localAuthority",
	boundaryRelease: "2025",
	codeProperty: "LAD25CD",
	nameProperty: "LAD25NM",
	areas,
});

test("marks a candidate eligible when the target release fully covers it", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
			{ WD25CD: "E2", WD25NM: "Ward Two", LAD25CD: "L1", LAD25NM: "LAD One" },
		]);
		writeLadSource(root, [{ code: "L1", name: "LAD One" }]);
		const artifacts = [
			wardArtifact([
				{ code: "E1", name: "Ward One" },
				{ code: "E2", name: "Ward Two" },
			]),
			ladArtifact([{ code: "L1", name: "LAD One" }]),
		];
		const inventory = compileRelationshipCandidates(root, artifacts);
		assert.equal(inventory.candidates.length, 1);
		const [candidate] = inventory.candidates;
		assert.equal(candidate.id, "ward-2025-to-local-authority-2025");
		assert.equal(candidate.status, "eligible");
		assert.equal(candidate.publishedCrosswalkId, undefined);
		assert.deepEqual(candidate.validation.endpoints, {
			from: { status: "verified", availableAreaCount: 2, referencedCodeCount: 2 },
			to: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
		});
		assert.deepEqual(candidate.validation.relationship, {
			sourceFeatureCount: 2,
			sourceCodeCount: 2,
			targetCodeCount: 1,
			multiTargetSourceCount: 0,
			missingValueFeatureCount: 0,
		});
		assert.deepEqual(candidate.validation.reasons, []);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("reports not-available when no compiled release matches the extra property pair", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
		]);
		const inventory = compileRelationshipCandidates(root, [
			wardArtifact([{ code: "E1", name: "Ward One" }]),
		]);
		assert.equal(inventory.candidates.length, 1);
		const [candidate] = inventory.candidates;
		assert.equal(candidate.status, "not-available");
		assert.equal(candidate.validation.endpoints.to.status, "not-available");
		assert.match(
			candidate.validation.reasons[0],
			/No compiled target release has LAD25CD\/LAD25NM fields\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flags needs-review when the target release is missing referenced codes", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
			{ WD25CD: "E2", WD25NM: "Ward Two", LAD25CD: "L2", LAD25NM: "LAD Two" },
		]);
		writeLadSource(root, [{ code: "L1", name: "LAD One" }]);
		const artifacts = [
			wardArtifact([
				{ code: "E1", name: "Ward One" },
				{ code: "E2", name: "Ward Two" },
			]),
			// L2 is referenced by the source but missing from the compiled release.
			ladArtifact([{ code: "L1", name: "LAD One" }]),
		];
		const inventory = compileRelationshipCandidates(root, artifacts);
		const [candidate] = inventory.candidates;
		assert.equal(candidate.status, "needs-review");
		assert.match(
			candidate.validation.reasons.join(" "),
			/1 target codes are absent from the compiled target release\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flags needs-review and counts multi-target source codes", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
			// Same ward code disagreeing about its LAD across features.
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L2", LAD25NM: "LAD Two" },
		]);
		writeLadSource(root, [
			{ code: "L1", name: "LAD One" },
			{ code: "L2", name: "LAD Two" },
		]);
		const artifacts = [
			wardArtifact([{ code: "E1", name: "Ward One" }]),
			ladArtifact([
				{ code: "L1", name: "LAD One" },
				{ code: "L2", name: "LAD Two" },
			]),
		];
		const inventory = compileRelationshipCandidates(root, artifacts);
		const [candidate] = inventory.candidates;
		assert.equal(candidate.status, "needs-review");
		assert.equal(candidate.validation.relationship.multiTargetSourceCount, 1);
		assert.match(
			candidate.validation.reasons.join(" "),
			/1 source codes map to more than one target code\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("counts features with a missing source or target value", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
			{ WD25CD: "E2", WD25NM: "Ward Two", LAD25CD: "", LAD25NM: "" },
		]);
		writeLadSource(root, [{ code: "L1", name: "LAD One" }]);
		const artifacts = [
			wardArtifact([
				{ code: "E1", name: "Ward One" },
				{ code: "E2", name: "Ward Two" },
			]),
			ladArtifact([{ code: "L1", name: "LAD One" }]),
		];
		const inventory = compileRelationshipCandidates(root, artifacts);
		const [candidate] = inventory.candidates;
		assert.equal(candidate.status, "needs-review");
		assert.equal(candidate.validation.relationship.missingValueFeatureCount, 1);
		assert.match(
			candidate.validation.reasons.join(" "),
			/1 source features have no usable source or target code\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("links a candidate to a published crosswalk that already covers it", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
		]);
		writeLadSource(root, [{ code: "L1", name: "LAD One" }]);
		const artifacts = [
			wardArtifact([{ code: "E1", name: "Ward One" }]),
			ladArtifact([{ code: "L1", name: "LAD One" }]),
		];
		const inventory = compileRelationshipCandidates(root, artifacts, [
			{
				id: "ward-to-local-authority-2025-clean-containment",
				from: { geography: "ward", boundaryRelease: "2025" },
				to: { geography: "localAuthority", boundaryRelease: "2025" },
			},
		]);
		const [candidate] = inventory.candidates;
		assert.equal(
			candidate.publishedCrosswalkId,
			"ward-to-local-authority-2025-clean-containment",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("skips a release whose declared source file is missing, and is deterministic", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		// meta.json declares a source, but the file itself was never written.
		const directory = join(root, "data", "boundaries", "ward", "2025");
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "meta.json"),
			JSON.stringify({ files: [{ path: "wards.geojson", role: "source" }] }),
		);
		const inventory1 = compileRelationshipCandidates(root, [
			wardArtifact([{ code: "E1", name: "Ward One" }]),
		]);
		assert.deepEqual(inventory1.candidates, []);
		assert.match(inventory1.contentHash, /^sha256:[a-f0-9]{64}$/);

		writeWardSource(root, [
			{ WD25CD: "E1", WD25NM: "Ward One", LAD25CD: "L1", LAD25NM: "LAD One" },
		]);
		writeLadSource(root, [{ code: "L1", name: "LAD One" }]);
		const artifacts = [
			wardArtifact([{ code: "E1", name: "Ward One" }]),
			ladArtifact([{ code: "L1", name: "LAD One" }]),
		];
		const first = compileRelationshipCandidates(root, artifacts);
		const second = compileRelationshipCandidates(root, artifacts);
		assert.equal(first.contentHash, second.contentHash);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
