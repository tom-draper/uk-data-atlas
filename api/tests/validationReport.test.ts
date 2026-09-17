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
import type { Measure, MeasureObservationArtifact } from "../src/dataCatalog";
import type { RelationshipCandidate } from "../src/relationshipCandidates";
import { compileValidationReport } from "../src/validation/compileValidationReport";
import {
	type MeasureTotal,
	type ObservationArtifact,
	readMeasureTotals,
	readValidationWaivers,
	type ValidationInputs,
	type ValidationWaiver,
} from "../src/validation/inputs";

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
					sourceCrs: "EPSG:4326",
				},
				{
					side: "to" as const,
					input: "lads.geojson",
					inputHash: "sha256:l",
					sourceCrs: "EPSG:4326",
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

const lsoaCodes = ["E01000001", "E01000002"];

const censusGeography = { type: "lsoa" as const, boundaryYear: 2025 };

const measure = (id: string, overrides: Partial<Measure> = {}): Measure => ({
	id,
	label: id,
	valueKind: "count",
	unit: "households",
	aggregation: { kind: "extensive", operation: "sum", available: true },
	sources: [
		{
			datasetId: "census",
			periods: ["2021"],
			sourceGeography: censusGeography,
			coverage: {
				kind: "source-reported",
				countries: ["GB-ENG"],
				recordCount: 2,
				note: "Every area.",
			},
		},
	],
	availability: { sourceExact: true, conversion: false, aggregation: true },
	links: { data: `/v1/data/${id}` },
	...overrides,
});

const observations = (
	measureId: string,
	values: number[],
	codes = lsoaCodes,
): MeasureObservationArtifact =>
	hashed({
		schemaVersion: 1 as const,
		measureId,
		sourceGeography: censusGeography,
		periods: [
			{
				period: "2021",
				records: codes.map((areaCode, index) => ({
					areaCode,
					value: values[index],
					status: "observed" as const,
				})),
			},
		],
	});

const inputs = (
	overrides: {
		crs?: string;
		crosswalks?: CrosswalkArtifact[];
		candidates?: RelationshipCandidate[];
		areaRegistryHash?: string;
		waivers?: ValidationWaiver[];
		wardCodes?: string[];
		geometryCorrections?: string[];
		measures?: Measure[];
		observations?: ObservationArtifact[];
		measureTotals?: MeasureTotal[];
		catalogueHash?: string;
	} = {},
): ValidationInputs => {
	const areaArtifacts = [
		areaArtifact("ward", overrides.wardCodes ?? ["W1", "W2"]),
		areaArtifact("localAuthority", ["L1"]),
		areaArtifact("lsoa", lsoaCodes),
	];
	const geographies = ["ward", "localAuthority", "lsoa"];
	const measures = overrides.measures ?? [
		measure("cars-total"),
		measure("cars-none"),
		measure("cars-some"),
	];
	const observationArtifacts = overrides.observations ?? [
		observations("cars-total", [5, 7]),
		observations("cars-none", [2, 3]),
		observations("cars-some", [3, 4]),
	];
	const crosswalks = overrides.crosswalks ?? [containment(), overlap()];
	const release = (geography: string) => ({
		id: "2025",
		geography,
		title: geography,
		temporalCoverage: "2025",
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
			releases: geographies.map(release),
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
			releases: geographies
				.map((geography) => `${geography}/2025`)
				.map((id) => ({
					id,
					status: "available",
					input: `${id}.geojson`,
					crs:
						id === "ward/2025"
							? (overrides.crs ?? "EPSG:4326")
							: "EPSG:4326",
					codeProperty: "CD",
					...(id === "ward/2025" && overrides.geometryCorrections
						? { corrections: overrides.geometryCorrections }
						: {}),
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
			releases: geographies.map((geography) => ({
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
		dataCatalog: {
			schemaVersion: 1,
			contentHash: "sha256:catalogue",
			source: {
				artifact: "data/precompiled/dataset-manifest.json",
				manifestVersion: 1,
			},
			datasets: [
				{
					id: "census",
					label: "Census",
					publisher: "ONS",
					sourceUrl: "https://example.com",
					temporalCoverage: "2021",
					licence: { name: "OGL" },
					inputs: [],
					summary: {
						datasetCount: 1,
						dataRecordCount: 2,
						boundaryYears: [2025],
					},
					compiled: { bytes: 1, sha256: "compiled" },
				},
			],
			measures,
		},
		exportManifest: {
			schemaVersion: 1,
			contentHash: "sha256:exports",
			dataCatalogHash: overrides.catalogueHash ?? "sha256:catalogue",
			fields: {},
			datasets: {},
			exports: (observationArtifacts as MeasureObservationArtifact[]).map(
				(artifact) => ({
					id: `${artifact.measureId}-observations`,
					measureId: artifact.measureId,
					datasetId: "census",
					periods: ["2021"],
					sourceGeography: censusGeography,
					format: "json" as const,
					artifact: `${artifact.measureId}-observations`,
					contentHash: artifact.contentHash,
					bytes: 1,
					href: `/v1/exports/${artifact.measureId}-observations`,
					recordCount: artifact.periods.reduce(
						(count, period) => count + period.records.length,
						0,
					),
					recordCountByPeriod: Object.fromEntries(
						artifact.periods.map((period) => [
							period.period,
							period.records.length,
						]),
					),
					schema: {
						version: 1,
						layout: "periods" as const,
						recordType: "numeric" as const,
						fields: [],
					},
					provenance: {
						measure: `/v1/measures/${artifact.measureId}`,
						datasets: [],
					},
				}),
			),
		},
		observationArtifacts: Object.fromEntries(
			observationArtifacts.map((artifact) => [
				`${artifact.measureId}-observations`,
				artifact,
			]),
		),
		measureTotals: overrides.measureTotals ?? [
			{ measureId: "cars-total", components: ["cars-none", "cars-some"] },
		],
		measureTotalsHash: "sha256:totals",
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
			["boundary-releases/lsoa/2025", "passed"],
			["boundary-releases/ward/2025", "passed"],
			["crosswalks/ward-to-lad", "passed"],
			["crosswalks/ward-to-lad-area-overlap", "passed"],
			["measures/cars-none", "passed"],
			["measures/cars-some", "passed"],
			["measures/cars-total", "passed"],
			["exports/cars-none-observations", "passed"],
			["exports/cars-some-observations", "passed"],
			["exports/cars-total-observations", "passed"],
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
		boundaryReleases: 3,
		areaIdentities: 3,
		servableGeometry: 3,
		withRelationships: 0,
		crosswalks: 2,
		weightedCrosswalks: 1,
		measures: 3,
		measureSources: 3,
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
	assert.equal(report.summary.coverage.servableGeometry, 2);
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
			},
		},
	);
	assert.equal(report.summary.coverage.servableGeometry, 3);
	const corrected = compileValidationReport(
		inputs({
			crs: "EPSG:27700",
			geometryCorrections: ["northern-ireland-offset"],
		}),
	);
	assert.equal(
		corrected.resources
			.find((resource) => resource.id === "boundary-releases/ward/2025")
			?.checks.find((entry) => entry.id === "geometry-servable")?.measured
			?.corrections,
		"northern-ireland-offset",
	);
	assert.throws(
		() =>
			compileValidationReport(
				inputs({ geometryCorrections: ["northern-ireland-offset"] }),
			),
		/boundary-releases\/ward\/2025 fails geometry-servable: Declares northern-ireland-offset, a British National Grid correction, on EPSG:4326 geometry\./,
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

test("checks each measure source against its artifact, boundaries and components", () => {
	const report = compileValidationReport(inputs());
	const total = report.resources.find(
		(resource) => resource.id === "exports/cars-total-observations",
	);
	assert.equal(total?.kind, "measure-source");
	assert.deepEqual(total?.checks, [
		{
			id: "artifact-integrity",
			status: "passed",
			measured: { periodCount: 1, recordCount: 2 },
		},
		{
			id: "records-resolve",
			status: "passed",
			measured: {
				areaCodeCount: 2,
				boundaryRelease: "2025",
				unresolvedCount: 0,
			},
		},
		{
			id: "countries-declared",
			status: "passed",
			measured: { countries: "GB-ENG" },
		},
		{
			id: "values-valid",
			status: "passed",
			measured: { recordCount: 2, minimum: 5, maximum: 7 },
		},
		{
			id: "components-sum-to-total",
			status: "passed",
			measured: {
				components: "cars-none, cars-some",
				comparedCount: 2,
				mismatchCount: 0,
				maxDifference: 0,
			},
		},
	]);
	assert.deepEqual(
		report.resources.find(
			(resource) => resource.id === "measures/cars-total",
		)?.checks,
		[
			{
				id: "measure-definition",
				status: "passed",
				measured: { sourceCount: 1 },
			},
		],
	);
	assert.equal(report.inputs.dataCatalog, "sha256:catalogue");
	assert.equal(report.inputs.measureTotals, "sha256:totals");
});

test("fails an edited observation artifact and components that no longer add up", () => {
	const edited = observations("cars-none", [2, 3]);
	edited.periods[0].records[1].value = 4;
	assert.throws(
		() =>
			compileValidationReport(
				inputs({
					observations: [
						observations("cars-total", [5, 7]),
						edited,
						observations("cars-some", [3, 4]),
					],
				}),
			),
		(error: Error) =>
			/exports\/cars-none-observations fails artifact-integrity: The artifact is inconsistent: its content does not reproduce its hash\./.test(
				error.message,
			) &&
			/exports\/cars-total-observations fails components-sum-to-total: The components do not add up to the total: components differ from the total in 1 of 2 area-periods: 2021 E01000002 \(7 against 8\)\./.test(
				error.message,
			),
	);
	assert.throws(
		() =>
			compileValidationReport(
				inputs({
					measureTotals: [
						{
							measureId: "cars-total",
							components: ["cars-none", "cars-all"],
						},
					],
				}),
			),
		/Measure total cars-total names cars-all, which is not in the catalogue\./,
	);
});

test("fails codes that no boundary release holds, or that belong to an undeclared nation", () => {
	const codes = ["E01000001", "W01000002"];
	const measures = [
		measure("cars-total"),
		measure("cars-none"),
		measure("cars-some"),
	];
	assert.throws(
		() =>
			compileValidationReport(
				inputs({
					measures,
					observations: [
						observations("cars-total", [5, 7], codes),
						observations("cars-none", [2, 3], codes),
						observations("cars-some", [3, 4], codes),
					],
				}),
			),
		(error: Error) =>
			/exports\/cars-total-observations fails records-resolve: No compiled lsoa release for 2025 holds every code: 2025 lacks 1 \(W01000002\)\./.test(
				error.message,
			) &&
			/exports\/cars-total-observations fails countries-declared: Records cover GB-ENG, GB-WLS, but the catalogue declares GB-ENG\./.test(
				error.message,
			),
	);
	const report = compileValidationReport(
		inputs({
			observations: [
				observations("cars-total", [5, 7], codes),
				observations("cars-none", [2, 3], codes),
				observations("cars-some", [3, 4], codes),
			],
			measures: measures.map((entry) => ({
				...entry,
				sources: entry.sources.map((source) => ({
					...source,
					coverage: {
						...source.coverage,
						countries: ["GB-ENG", "GB-WLS"],
					},
				})),
			})),
			waivers: [
				{
					check: "records-resolve",
					reason: "Published on a newer code.",
					resources: [
						"exports/cars-none-observations",
						"exports/cars-some-observations",
						"exports/cars-total-observations",
					],
				},
			],
		}),
	);
	assert.deepEqual(
		report.resources
			.find(
				(resource) => resource.id === "exports/cars-none-observations",
			)
			?.checks.find((entry) => entry.id === "records-resolve")?.measured,
		{ areaCodeCount: 2, boundaryRelease: null, unresolvedCount: 1 },
	);
});

test("fails invalid values and an inconsistent measure definition", () => {
	const decile = measure("imd-decile", {
		valueKind: "ordinal",
		unit: "decile",
		aggregation: {
			kind: "non-aggregatable",
			statistic: "decile",
			note: "A band of ranks.",
			available: false,
		},
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
	});
	assert.throws(
		() =>
			compileValidationReport(
				inputs({
					measures: [measure("cars-none"), decile],
					observations: [
						observations("cars-none", [2.5, -1]),
						observations("imd-decile", [1, 11]),
					],
					measureTotals: [],
				}),
			),
		(error: Error) =>
			/exports\/cars-none-observations fails values-valid: 2 records are invalid: 2021 E01000001 counts 2\.5, which is not a whole number of at least 0, 2021 E01000002 counts -1, which is not a whole number of at least 0\./.test(
				error.message,
			) &&
			/exports\/imd-decile-observations fails values-valid: 1 records are invalid: 2021 E01000002 is 11, not a decile from 1 to 10\./.test(
				error.message,
			) &&
			/measures\/imd-decile fails measure-definition: The definition is inconsistent: its availability and its non-aggregatable aggregation disagree on whether it can be aggregated\./.test(
				error.message,
			),
	);
});

test("fails an export manifest built from an older data catalogue", () => {
	assert.throws(
		() => compileValidationReport(inputs({ catalogueHash: "sha256:old" })),
		/atlas fails registry-links: Built against an older data catalogue: export manifest\./,
	);
});

test("reads measure totals and rejects one without components", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const path = join(directory, "measure-totals.json");
		const write = (totals: unknown[]) =>
			writeFileSync(path, JSON.stringify({ schemaVersion: 1, totals }));
		const total = {
			measureId: "cars-total",
			components: ["cars-none", "cars-some"],
		};
		write([total]);
		const { measureTotals, measureTotalsHash } = readMeasureTotals(path);
		assert.deepEqual(measureTotals, [total]);
		assert.match(measureTotalsHash, /^sha256:[a-f0-9]{64}$/);
		for (const invalid of [
			{ ...total, components: ["cars-none"] },
			{ ...total, measureId: "" },
		]) {
			write([invalid]);
			assert.throws(
				() => readMeasureTotals(path),
				/Invalid measure total/,
			);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
