import { performance } from "node:perf_hooks";
import { classify } from "./classify.mjs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { areaMultiPolygon } from "../../shared/areaGeometryPieces";
import { readCrosswalkAdapters } from "../../shared/crosswalkAdapters";
import {
	apiRootOf,
	artifactDirectory,
	configDirectory,
} from "../../shared/dataLayout";
import { readGeometrySourceLookup } from "../../shared/geometrySources";
import { readGeometries } from "../../shared/rawAreaGeometries";
import { readStoredText } from "../../shared/storedText";
import type { AreaOverlapCrosswalkArtifact } from "../../shared/crosswalkTypes";

const root = process.cwd();
const id =
	process.argv[2] ??
	"national-park-2020-12-gb-bgc-to-local-authority-2020-12-uk-bgc-area-overlap";
const adapter = readCrosswalkAdapters(
	join(configDirectory(root), "crosswalk-adapters.json"),
).find((entry) => entry.id === id);
if (!adapter || adapter.method !== "area-overlap")
	throw new Error(`Unknown area-overlap crosswalk: ${id}`);
const reference = JSON.parse(
	readStoredText(join(artifactDirectory(root), "crosswalks", `${id}.json`)),
) as AreaOverlapCrosswalkArtifact;
if (reference.method !== "area-overlap" || reference.id !== id)
	throw new Error("Invalid reference artifact");
const start = performance.now();
const sources = readGeometrySourceLookup(apiRootOf(root));
const from = readGeometries(
	root,
	id,
	adapter.from,
	sources,
	adapter.sourceCodePattern
		? new RegExp(adapter.sourceCodePattern)
		: undefined,
);
const to = readGeometries(root, id, adapter.to, sources);
const readSeconds = (performance.now() - start) / 1000;
for (const [side, value] of [
	["from", from],
	["to", to],
] as const) {
	const input = reference.provenance.inputs.find(
		(entry) => entry.side === side,
	);
	if (!input || input.inputHash !== value.provenance.inputHash)
		throw new Error(`${side} input differs from reference artifact`);
}
const expected = new Map(
	reference.records.flatMap((record) =>
		record.targets.map(
			(target) =>
				[
					`${record.source.code}|${target.code}`,
					{ area: target.overlapAreaM2, weight: target.weight },
				] as const,
		),
	),
);
if (!expected.size) throw new Error("Reference has no pairs");
const instance = await DuckDBInstance.create(":memory:");
const connection = await instance.connect();
try {
	let started = performance.now();
	await connection.run(
		"INSTALL spatial; LOAD spatial; CREATE TABLE shapes (side VARCHAR, code VARCHAR, json VARCHAR)",
	);
	const appender = await connection.createAppender("shapes");
	for (const [side, input] of [
		["from", from],
		["to", to],
	] as const) {
		for (const [code, geometry] of input.geometries) {
			appender.appendVarchar(side);
			appender.appendVarchar(code);
			appender.appendVarchar(
				JSON.stringify({
					type: "MultiPolygon",
					coordinates: areaMultiPolygon(geometry),
				}),
			);
			appender.endRow();
		}
	}
	appender.closeSync();
	await connection.run(
		"CREATE TABLE raw_geometries AS SELECT side, code, ST_GeomFromGeoJSON(json) AS geom FROM shapes; CREATE TABLE geometries AS SELECT side, code, ST_MakeValid(geom) AS geom FROM raw_geometries",
	);
	const invalid = await connection.runAndReadAll(
		"SELECT count(*) FROM raw_geometries WHERE NOT ST_IsValid(geom)",
	);
	const invalidGeometries = Number(invalid.getRows()[0]?.[0]);
	const loadSeconds = (performance.now() - started) / 1000;
	started = performance.now();
	const result = await connection.runAndReadAll(`
    SELECT a.code, b.code,
      ST_Area(ST_Transform(ST_Intersection(a.geom, b.geom), 'EPSG:4326', 'EPSG:6933', always_xy := true)) AS area,
      ST_AsGeoJSON(ST_CollectionExtract(ST_Intersection(a.geom, b.geom), 3)) AS geometry
    FROM geometries a JOIN geometries b ON ST_Intersects(a.geom, b.geom)
    WHERE a.side = 'from' AND b.side = 'to'
  `);
	const querySeconds = (performance.now() - started) / 1000;
	started = performance.now();
	const measured = new Map<string, number>();
	const raw = new Map<string, number>();
	let unresolved = 0;
	let includedOutsideBand = 0;
	for (const [fromCode, toCode, area, geometry] of result.getRows()) {
		const value = Number(area);
		if (value <= 0) continue;
		const source = String(fromCode);
		const target = String(toCode);
		const key = `${source}|${target}`;
		raw.set(key, value);
		const rule = classify(
			adapter,
			source,
			target,
			JSON.parse(String(geometry)),
		);
		if (rule.unresolved) unresolved++;
		if (rule.includedOutsideBand) includedOutsideBand++;
		if (rule.keep) measured.set(key, value);
	}
	const missing = [...expected.keys()].filter((key) => !measured.has(key));
	const extra = [...measured.keys()].filter((key) => !expected.has(key));
	const totals = new Map<string, number>();
	for (const [key, area] of measured) {
		const source = key.split("|")[0]!;
		totals.set(source, (totals.get(source) ?? 0) + area);
	}
	const differences = [...expected]
		.flatMap(([key, reference]) => {
			const area = measured.get(key);
			if (area === undefined) return [];
			const source = key.split("|")[0]!;
			return [
				{
					key,
					referenceAreaM2: reference.area,
					duckdbAreaM2: Math.round(area),
					relativeDifference:
						Math.abs(area - reference.area) /
						Math.max(1, reference.area),
					referenceWeight: reference.weight,
					duckdbWeight:
						Math.round((area / totals.get(source)!) * 1e6) / 1e6,
				},
			];
		})
		.sort((a, b) => b.relativeDifference - a.relativeDifference);
	const classificationSeconds = (performance.now() - started) / 1000;
	const weightDifferences = differences.filter(
		(value) => value.referenceWeight !== value.duckdbWeight,
	);
	console.log(
		JSON.stringify(
			{
				id,
				invalidGeometries,
				sources: from.geometries.size,
				targets: to.geometries.size,
				referencePairs: expected.size,
				duckdbPositiveAreaPairs: raw.size,
				duckdbKeptPairs: measured.size,
				unresolved,
				includedOutsideBand,
				weightDifferences: weightDifferences.length,
				missing: missing.length,
				extra: extra.length,
				examples: {
					missing: missing.slice(0, 10),
					extra: extra.slice(0, 10),
					largestAreaDifferences: differences.slice(0, 10),
					weightDifferences: weightDifferences.slice(0, 10),
				},
				readSeconds,
				loadSeconds,
				querySeconds,
				classificationSeconds,
				peakRssMiB: process.resourceUsage().maxRSS / 1024,
			},
			null,
			2,
		),
	);
} finally {
	connection.closeSync();
	instance.closeSync();
}
