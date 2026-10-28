import { performance } from "node:perf_hooks";
import { DuckDBInstance } from "@duckdb/node-api";
import {
	readSqlitePostcodeIndex,
	readSqlitePostcodeShard,
} from "../../shared/atlasPostcodesReader";
import { apiRootOf } from "../../shared/dataLayout";
import { createAreaGeometryCache } from "../../shared/geometryLoader";
import { parsePostcode } from "../../shared/postcodeRules";
import { postcodeLookupPoint } from "../../shared/postcodeLookupPoint";
import { NONE, SEVERAL, placePoints } from "../../shared/postcodeAreaCompiler";
import type { PostcodeShard } from "../../shared/postcodeIndexTypes";

const apiRoot = apiRootOf(process.cwd());
const geography = "localAuthority";
const release = "2024-05-uk-bgc";
const index = readSqlitePostcodeIndex(apiRoot);
const cache = createAreaGeometryCache(apiRoot, 1);
const areas = cache
	.codes(geography, release)
	.map((code) => ({ code, geometry: cache.get(geography, release, code)! }));
const points: Array<[number, number]> = [];
let position = 0;
for (const entry of index.artifact.shards) {
	const shard = JSON.parse(
		readSqlitePostcodeShard(apiRoot, entry),
	) as PostcodeShard;
	for (const postcode of shard.postcodes) {
		if (position++ % 40 !== 0) continue;
		const found = index.lookup(
			parsePostcode(postcode) as Extract<
				ReturnType<typeof parsePostcode>,
				{ kind: "unit" }
			>,
		);
		if (found.status !== "found" || !found.record.centroid) continue;
		const point = postcodeLookupPoint(found.record.centroid);
		points.push([point.lng, point.lat]);
	}
}
if (points.length < 1000 || areas.length < 2)
	throw new Error("Insufficient production input");
let started = performance.now();
const node = placePoints(
	Float64Array.from(points, (p) => p[0]),
	Float64Array.from(points, (p) => p[1]),
	areas.map((a) => a.code),
	(code) => areas.find((a) => a.code === code)?.geometry,
);
const nodeSeconds = (performance.now() - started) / 1000;
const expected = new Set<string>();
for (let i = 0; i < points.length; i++) {
	const area = node.area[i]!;
	if (area === NONE) continue;
	if (area === SEVERAL)
		for (const [code, containment] of node.several.get(i)!)
			expected.add(`${i}:${node.codes[code]}:${containment}`);
	else expected.add(`${i}:${node.codes[area]}:interior`);
}
const instance = await DuckDBInstance.create(":memory:");
const connection = await instance.connect();
try {
	started = performance.now();
	await connection.run(
		"INSTALL spatial; LOAD spatial; CREATE TEMP TABLE areas (code VARCHAR, json VARCHAR); CREATE TEMP TABLE points (position INTEGER, x DOUBLE, y DOUBLE)",
	);
	const areaAppender = await connection.createAppender("areas");
	for (const area of areas) {
		areaAppender.appendVarchar(area.code);
		areaAppender.appendVarchar(JSON.stringify(area.geometry));
		areaAppender.endRow();
	}
	areaAppender.closeSync();
	const pointAppender = await connection.createAppender("points");
	for (const [position, [x, y]] of points.entries()) {
		pointAppender.appendInteger(position);
		pointAppender.appendDouble(x);
		pointAppender.appendDouble(y);
		pointAppender.endRow();
	}
	pointAppender.closeSync();
	await connection.run(
		"CREATE TEMP TABLE geometries AS SELECT code, ST_GeomFromGeoJSON(json) AS geom FROM areas; CREATE TEMP TABLE locations AS SELECT position, ST_Point(x, y) AS geom FROM points",
	);
	const loadSeconds = (performance.now() - started) / 1000;
	started = performance.now();
	const result = await connection.runAndReadAll(
		"SELECT p.position, a.code, CASE WHEN ST_Contains(a.geom, p.geom) THEN 'interior' ELSE 'boundary' END FROM locations p JOIN geometries a ON ST_Covers(a.geom, p.geom)",
	);
	const querySeconds = (performance.now() - started) / 1000;
	const actual = new Set(
		result
			.getRows()
			.map(
				([position, code, containment]) =>
					`${position}:${code}:${containment}`,
			),
	);
	const missing = [...expected].filter((value) => !actual.has(value));
	const extra = [...actual].filter((value) => !expected.has(value));
	console.log(
		JSON.stringify(
			{
				geography,
				release,
				points: points.length,
				areas: areas.length,
				nodeMatches: expected.size,
				duckdbMatches: actual.size,
				missing: missing.length,
				extra: extra.length,
				examples: {
					missing: missing.slice(0, 5),
					extra: extra.slice(0, 5),
				},
				nodeSeconds,
				loadSeconds,
				querySeconds,
				duckdbTotalSeconds: loadSeconds + querySeconds,
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
