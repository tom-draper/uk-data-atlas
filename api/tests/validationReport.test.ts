import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { AreaReleaseArtifact } from "../src/areaInventory";
import type {
	AreaOverlapCrosswalkArtifact,
	CrosswalkArtifact,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import type { RelationshipCandidate } from "../src/relationshipCandidates";
import {
	compileValidationReport,
	readValidationWaivers,
	type ValidationInputs,
	type ValidationWaiver,
} from "../src/validationReport";

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

// Hash content the way the compilers do: over everything before the hash.
const hashed = <T extends object>(content: T) => ({
	...content,
	contentHash: sha256(JSON.stringify(content)),
});

const areaArtifact = (
	geography: string,
	codes: string[],
): AreaReleaseArtifact =>
	hashed({
		schemaVersion: 1 as const,
		geography,
		boundaryRelease: "2025",
		codeProperty: "CD",
		nameProperty: "NM",
		areas: codes.map((code) => ({ code, name: `Area ${code}` })),
	});

const endpoints = (from: number, to: number) => ({
	from: {
		status: "verified" as const,
		availableAreaCount: from,
		referencedCodeCount: from,
	},
	to: {
		status: "verified" as const,
		availableAreaCount: to,
		referencedCodeCount: to,
	},
});

const sides = {
	from: { geography: "ward", boundaryRelease: "2025" },
	to: { geography: "localAuthority", boundaryRelease: "2025" },
};

const containment = (
	records: PropertyCrosswalkArtifact["records"] = [
		{
			source: { code: "W1", labels: ["W1"] },
			targets: [{ code: "L1", labels: ["L1"] }],
		},
		{
			source: { code: "W2", labels: ["W2"] },
			targets: [{ code: "L1", labels: ["L1"] }],
		},
	],
): PropertyCrosswalkArtifact =>
	hashed({
		schemaVersion: 1 as const,
		id: "ward-to-lad",
		method: "clean-containment" as const,
		quality: "publisher-supplied" as const,
		weighting: { status: "not-applicable" as const },
		...sides,
		provenance: { input: "wards.geojson", inputHash: "sha256:wards" },
		validation: { sourceNameConflicts: [], endpoints: endpoints(2, 1) },
		records,
	});

const overlapTarget = (weight: number) => ({
	code: "L1",
	labels: ["L1"],
	weight,
	overlapAreaM2: 500,
	sourceShare: 1,
	targetShare: 0.5,
});

const overlap = (): AreaOverlapCrosswalkArtifact =>
	hashed({
		schemaVersion: 1 as const,
		id: "ward-to-lad-area-overlap",
		method: "area-overlap" as const,
		quality: "derived" as const,
		weighting: {
			status: "provided" as const,
			basis: "area" as const,
			normalisation: "per-source" as const,
		},
		...sides,
		provenance: {
			inputs: [
				{
					side: "from" as const,
					input: "wards.geojson",
					inputHash: "sha256:w",
				},
				{
					side: "to" as const,
					input: "lads.geojson",
					inputHash: "sha256:l",
				},
			],
			areaProjection: "EPSG:6933" as const,
			clipping: "polygon-clipping@0.15.7",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: endpoints(2, 1),
			overlap: {
				candidatePairCount: 2,
				intersectingPairCount: 3,
				sliverPairCount: 1,
				sliverWidthM: 100,
				widestSliverWidthM: 12,
				narrowestOverlapWidthM: 400,
				minimumCoverage: 0.99,
				minimumSourceCoverage: 1,
				minimumTargetCoverage: 1,
			},
		},
		records: [
			{
				source: {
					code: "W1",
					labels: ["W1"],
					areaM2: 500,
					coverage: 1,
				},
				targets: [overlapTarget(1)],
			},
			{
				source: {
					code: "W2",
					labels: ["W2"],
					areaM2: 500,
					coverage: 1,
				},
				targets: [overlapTarget(1)],
			},
		],
	});

const eligibleCandidate: RelationshipCandidate = {
	id: "ward-2025-to-local-authority-2025",
	input: "wards.geojson",
	from: { ...sides.from, codeProperty: "WD", nameProperty: "WDNM" },
	to: { ...sides.to, codeProperty: "LAD", nameProperty: "LADNM" },
	status: "eligible",
	validation: {
		endpoints: endpoints(2, 1),
		relationship: {
			sourceFeatureCount: 2,
			sourceCodeCount: 2,
			targetCodeCount: 1,
			multiTargetSourceCount: 0,
			missingValueFeatureCount: 0,
		},
		reasons: [],
	},
};

const inputs = (
	overrides: {
		crs?: string;
		crosswalks?: CrosswalkArtifact[];
		candidates?: RelationshipCandidate[];
		areaRegistryHash?: string;
		waivers?: ValidationWaiver[];
		wardCodes?: string[];
	} = {},
): ValidationInputs => {
	const areaArtifacts = [
		areaArtifact("ward", overrides.wardCodes ?? ["W1", "W2"]),
		areaArtifact("localAuthority", ["L1"]),
	];
	const crosswalks = overrides.crosswalks ?? [containment(), overlap()];
	const release = (geography: string) => ({
		id: "2025",
		geography,
		title: geography,
		coverage: { countries: ["GB-ENG"] },
		source: {
			publisher: "ONS",
			url: "https://example.com",
			licence: { name: "OGL", url: "https://example.com/ogl" },
		},
		metadataHash: "sha256:meta",
	});
	return {
		boundaryRegistry: {
			schemaVersion: 1,
			contentHash: "sha256:registry",
			releases: [release("ward"), release("localAuthority")],
		},
		areaInventory: {
			schemaVersion: 1,
			contentHash: "sha256:areas",
			boundaryRegistryHash:
				overrides.areaRegistryHash ?? "sha256:registry",
			releases: areaArtifacts.map((artifact) => ({
				id: "2025",
				geography: artifact.geography,
				status: "available",
				recordCount: artifact.areas.length,
				artifact: `areas/${artifact.geography}/2025.json`,
				contentHash: artifact.contentHash,
				codeProperty: "CD",
				nameProperty: "NM",
			})),
		},
		areaArtifacts,
		geometrySources: {
			schemaVersion: 1,
			contentHash: "sha256:geometry",
			releases: ["ward/2025", "localAuthority/2025"].map((id) => ({
				id,
				status: "available",
				input: `${id}.geojson`,
				crs:
					id === "ward/2025"
						? (overrides.crs ?? "EPSG:4326")
						: "EPSG:4326",
				codeProperty: "CD",
			})),
		},
		crosswalkInventory: {
			schemaVersion: 1,
			contentHash: "sha256:crosswalks",
			crosswalks: crosswalks.map((crosswalk) => ({
				id: crosswalk.id,
				from: crosswalk.from,
				to: crosswalk.to,
				method: crosswalk.method,
				quality: crosswalk.quality,
				weighting: crosswalk.weighting,
				recordCount: crosswalk.records.length,
				artifact: `crosswalks/${crosswalk.id}.json`,
				contentHash: crosswalk.contentHash,
			})),
		},
		crosswalkArtifacts: crosswalks,
		relationshipCandidates: {
			schemaVersion: 1,
			contentHash: "sha256:candidates",
			candidates: overrides.candidates ?? [],
		},
		geographyInventory: {
			schemaVersion: 1,
			contentHash: "sha256:geography",
			boundaryRegistryHash: "sha256:registry",
			releases: ["ward", "localAuthority"].map((geography) => ({
				id: "2025",
				geography,
				countries: ["GB-ENG"],
				inputFormats: ["geojson"],
				areaIdentities: {
					status: "available",
					recordCount: 1,
					artifact: `areas/${geography}/2025.json`,
				},
				relationships: { status: "not-compiled", reason: "None." },
			})),
			geographies: [],
		},
		waivers: overrides.waivers ?? [],
		waiversHash: "sha256:waivers",
	};
};

test("passes every check on consistent artifacts and recomputes their figures", () => {
	const report = compileValidationReport(inputs());
	assert.deepEqual(
		report.resources.map((resource) => [resource.id, resource.status]),
		[
			["atlas", "passed"],
			["boundary-releases/localAuthority/2025", "passed"],
			["boundary-releases/ward/2025", "passed"],
			["crosswalks/ward-to-lad", "passed"],
			["crosswalks/ward-to-lad-area-overlap", "passed"],
		],
	);
	assert.deepEqual(
		report.resources
			.find((resource) => resource.id === "crosswalks/ward-to-lad")
			?.checks.map((entry) => entry.id),
		[
			"artifact-integrity",
			"endpoints-verified",
			"source-names-consistent",
			"targets-present",
			"single-parent",
		],
	);
	const overlapChecks = report.resources.find(
		(resource) => resource.id === "crosswalks/ward-to-lad-area-overlap",
	)?.checks;
	assert.deepEqual(
		overlapChecks?.find((entry) => entry.id === "area-coverage")?.measured,
		{
			minimumCoverage: 0.99,
			minimumSourceCoverage: 1,
			minimumTargetCoverage: 1,
		},
	);
	assert.equal(report.summary.waivedCount, 0);
	assert.equal(report.summary.checkCount, report.summary.passedCount);
	assert.deepEqual(report.summary.coverage, {
		boundaryReleases: 2,
		areaIdentities: 2,
		servableGeometry: 2,
		withRelationships: 0,
		crosswalks: 2,
		weightedCrosswalks: 1,
	});
	assert.match(report.contentHash, /^sha256:[a-f0-9]{64}$/);
});

test("fails on an unwaived exception and publishes a waived one with its reason", () => {
	assert.throws(
		() => compileValidationReport(inputs({ crs: "EPSG:3857" })),
		/boundary-releases\/ward\/2025 fails geometry-servable: Geometry is EPSG:3857, and no transformation to WGS84 is available\./,
	);
	const report = compileValidationReport(
		inputs({
			crs: "EPSG:3857",
			waivers: [
				{
					check: "geometry-servable",
					reason: "No transformation yet.",
					resources: ["boundary-releases/ward/2025"],
				},
			],
		}),
	);
	const ward = report.resources.find(
		(resource) => resource.id === "boundary-releases/ward/2025",
	);
	assert.equal(ward?.status, "waived");
	assert.deepEqual(
		ward?.checks.find((entry) => entry.id === "geometry-servable"),
		{
			id: "geometry-servable",
			status: "waived",
			detail: "Geometry is EPSG:3857, and no transformation to WGS84 is available.",
			measured: { crs: "EPSG:3857" },
			waiver: { reason: "No transformation yet." },
		},
	);
	assert.equal(report.summary.waivedCount, 1);
	assert.equal(report.summary.coverage.servableGeometry, 1);
});

test("passes British National Grid geometry and records its transformation", () => {
	const report = compileValidationReport(inputs({ crs: "EPSG:27700" }));
	assert.deepEqual(
		report.resources
			.find((resource) => resource.id === "boundary-releases/ward/2025")
			?.checks.find((entry) => entry.id === "geometry-servable"),
		{
			id: "geometry-servable",
			status: "passed",
			measured: {
				crs: "EPSG:27700",
				transformation: "OSGB36 to WGS 84 (6)",
				transformationAccuracyM: 2,
				refusedAreaCount: 0,
			},
		},
	);
	assert.equal(report.summary.coverage.servableGeometry, 2);
	assert.throws(
		() =>
			compileValidationReport(
				inputs({ crs: "EPSG:27700", wardCodes: ["W1", "W2", "N1"] }),
			),
		/boundary-releases\/ward\/2025 fails geometry-servable: 1 of 3 areas cannot be served\. Northern Ireland geometry/,
	);
});

test("fails on a waiver that no longer matches an exception, or is listed twice", () => {
	const waiver: ValidationWaiver = {
		check: "geometry-servable",
		reason: "Stale.",
		resources: ["boundary-releases/ward/2025"],
	};
	assert.throws(
		() => compileValidationReport(inputs({ waivers: [waiver] })),
		/Unused waiver, the check now passes or the resource is gone: geometry-servable boundary-releases\/ward\/2025/,
	);
	assert.throws(
		() =>
			compileValidationReport(
				inputs({ crs: "EPSG:3857", waivers: [waiver, waiver] }),
			),
		/Duplicate waiver: geometry-servable boundary-releases\/ward\/2025/,
	);
});

test("detects an edited crosswalk from its hash and its weights", () => {
	const edited = overlap();
	edited.records[0].targets[0].weight = 0.9;
	assert.throws(
		() => compileValidationReport(inputs({ crosswalks: [edited] })),
		(error: Error) =>
			/crosswalks\/ward-to-lad-area-overlap fails artifact-integrity: The artifact is inconsistent: its content does not reproduce its hash/.test(
				error.message,
			) &&
			/crosswalks\/ward-to-lad-area-overlap fails weights-sum-to-one: .* for W1\./.test(
				error.message,
			),
	);
});

test("fails containment with more than one parent", () => {
	const twoParents = containment([
		{
			source: { code: "W1", labels: ["W1"] },
			targets: [
				{ code: "L1", labels: ["L1"] },
				{ code: "L2", labels: ["L2"] },
			],
		},
	]);
	assert.throws(
		() => compileValidationReport(inputs({ crosswalks: [twoParents] })),
		(error: Error) =>
			/crosswalks\/ward-to-lad fails single-parent: Sources without exactly one parent: W1\./.test(
				error.message,
			) &&
			/crosswalks\/ward-to-lad fails endpoints-verified: to: 1 codes do not resolve \(L2\)\./.test(
				error.message,
			),
	);
});

test("fails on stale inventories and on candidates awaiting a decision", () => {
	assert.throws(
		() =>
			compileValidationReport(inputs({ areaRegistryHash: "sha256:old" })),
		/atlas fails registry-links: Built against an older boundary registry: area inventory\./,
	);
	assert.throws(
		() =>
			compileValidationReport(
				inputs({ candidates: [eligibleCandidate] }),
			),
		/boundary-releases\/ward\/2025 fails candidates-reviewed: Relationship candidates awaiting a decision: ward-2025-to-local-authority-2025 \(eligible\)\./,
	);
	const published = compileValidationReport(
		inputs({
			candidates: [
				{ ...eligibleCandidate, publishedCrosswalkId: "ward-to-lad" },
			],
		}),
	);
	assert.equal(published.summary.waivedCount, 0);
});

test("reads waivers and rejects one without a known check or a reason", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const path = join(directory, "validation-waivers.json");
		const write = (waivers: unknown[]) =>
			writeFileSync(path, JSON.stringify({ schemaVersion: 1, waivers }));
		const waiver = {
			check: "geometry-servable",
			reason: "No reprojection step yet.",
			resources: ["boundary-releases/ward/2025"],
		};
		write([waiver]);
		const { waivers, waiversHash } = readValidationWaivers(path);
		assert.deepEqual(waivers, [waiver]);
		assert.match(waiversHash, /^sha256:[a-f0-9]{64}$/);
		for (const invalid of [
			{ ...waiver, check: "geometry-valid" },
			{ ...waiver, reason: " " },
			{ ...waiver, resources: [] },
		]) {
			write([invalid]);
			assert.throws(
				() => readValidationWaivers(path),
				/Invalid validation waiver/,
			);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
