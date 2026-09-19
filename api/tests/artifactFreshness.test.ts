import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { observationPartitionKey } from "../src/measureCompatibility";
import {
	readMeasureTotals,
	readValidationWaivers,
} from "../src/validation/inputs";

/**
 * A compiled artifact records the content hash of each artifact it was built
 * from. When one of those is rebuilt and the artifact is not, it describes a
 * catalogue that no longer exists: a validation report that never checked a
 * newly published crosswalk still reads as passing. The Atlas release hashes
 * whatever files are present, so it cannot see this; these tests can.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(apiRoot, "public");
const read = (path: string) =>
	JSON.parse(readFileSync(join(publicRoot, path), "utf8")) as Record<
		string,
		any
	>;
const hashOf = (path: string) => read(path).contentHash as string;

const ARTIFACTS: Record<string, string> = {
	boundaryRegistry: "boundary-releases.json",
	areaInventory: "area-inventory.json",
	geometrySources: "geometry-sources.json",
	crosswalkInventory: "crosswalk-inventory.json",
	analysisGeographyInventory: "analysis-geographies.json",
	analysisGeographyValidation: "analysis-geography-validation.json",
	relationshipCandidates: "relationship-candidates.json",
	geographyInventory: "geography-inventory.json",
	dataCatalog: "data-catalog.json",
	exportManifest: "export-manifest.json",
	namedLocationInventory: "named-locations.json",
	populationObservations: "population-observations.json",
	populationLocalAuthorityObservations:
		"population-local-authority-observations.json",
};

/** The upstream artifacts each compiled artifact names by a `*Hash` field. */
const RECORDED_UPSTREAM: Record<string, string[]> = {
	"area-inventory.json": ["boundaryRegistryHash"],
	"export-manifest.json": ["dataCatalogHash"],
	"geography-inventory.json": ["boundaryRegistryHash"],
	"location-projection-inventory.json": [
		"namedLocationInventoryHash",
		"crosswalkInventoryHash",
	],
	"relationship-paths.json": ["crosswalkInventoryHash"],
	"analysis-geographies.json": [
		"dataCatalogHash",
		"crosswalkInventoryHash",
	],
	"analysis-geography-validation.json": [
		"analysisGeographyInventoryHash",
		"dataCatalogHash",
		"crosswalkInventoryHash",
	],
};

const compiled = readdirSync(publicRoot)
	.filter((name) => name.endsWith(".json"))
	.flatMap((name) => {
		try {
			const artifact = read(name);
			return artifact && typeof artifact === "object"
				? [{ name, artifact }]
				: [];
		} catch {
			return [];
		}
	});

test("declares every upstream hash an artifact records", () => {
	const undeclared = compiled.flatMap(({ name, artifact }) =>
		Object.keys(artifact)
			.filter(
				(key) =>
					key.endsWith("Hash") &&
					key !== "contentHash" &&
					!(RECORDED_UPSTREAM[name] ?? []).includes(key),
			)
			.map((key) => `${name} ${key}`),
	);
	assert.deepEqual(undeclared, []);
});

test("builds each artifact from the current version of what it records", () => {
	const stale: string[] = [];
	for (const [name, fields] of Object.entries(RECORDED_UPSTREAM)) {
		if (!existsSync(join(publicRoot, name))) continue;
		const artifact = read(name);
		for (const field of fields) {
			const upstream = ARTIFACTS[field.slice(0, -"Hash".length)]!;
			if (artifact[field] !== hashOf(upstream))
				stale.push(`${name} ${field}: rebuild after ${upstream}`);
		}
	}
	assert.deepEqual(stale, []);
});

test("builds the validation report from the current catalogue and config", () => {
	const { inputs } = read("validation-report.json");
	const expected: Record<string, string> = {
		...Object.fromEntries(
			[
				"boundaryRegistry",
				"areaInventory",
				"geometrySources",
				"crosswalkInventory",
				"relationshipCandidates",
				"geographyInventory",
				"dataCatalog",
				"exportManifest",
			].map((key) => [key, hashOf(ARTIFACTS[key]!)]),
		),
		measureTotals: readMeasureTotals(
			join(apiRoot, "config", "measure-totals.json"),
		).measureTotalsHash,
		waivers: readValidationWaivers(
			join(apiRoot, "config", "validation-waivers.json"),
		).waiversHash,
	};
	assert.deepEqual(
		Object.keys(inputs).filter((key) => inputs[key] !== expected[key]),
		[],
		"rebuild the validation report: pnpm build:validation-report",
	);
});

test("builds measure compatibility from the current observations and areas", () => {
	const { inputs } = read("measure-compatibility.json");
	const observationHashes = new Map(
		compiled.flatMap(({ artifact }) =>
			typeof artifact.measureId === "string" &&
			artifact.sourceGeography &&
			Array.isArray(artifact.periods)
				? [
						[
							observationPartitionKey(
								artifact as Parameters<
									typeof observationPartitionKey
								>[0],
							),
							artifact.contentHash,
						],
					]
				: [],
		),
	);
	const areaHashes = new Map(
		(read("area-inventory.json").releases as any[]).flatMap((release) =>
			release.status === "available"
				? [[`${release.geography}/${release.id}`, release.contentHash]]
				: [],
		),
	);
	const stale = [
		...[
			"dataCatalog",
			"boundaryRegistry",
			"populationObservations",
			"populationLocalAuthorityObservations",
		].filter((key) => inputs[key] !== hashOf(ARTIFACTS[key]!)),
		...Object.entries(inputs.measureObservations as Record<string, string>)
			.filter(
				([measureId, hash]) =>
					observationHashes.get(measureId) !== hash,
			)
			.map(([measureId]) => `measureObservations ${measureId}`),
		...Object.entries(inputs.areaArtifacts as Record<string, string>)
			.filter(([release, hash]) => areaHashes.get(release) !== hash)
			.map(([release]) => `areaArtifacts ${release}`),
	];
	assert.deepEqual(
		stale,
		[],
		"rebuild measure compatibility: pnpm build:measure-compatibility",
	);
});
